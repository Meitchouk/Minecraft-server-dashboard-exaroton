import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { api, queryConsole, defaultServerId } from "@/lib/exaroton";
import { parseInventory, type InvSlot } from "@/lib/snbt";

// Copias automaticas de inventarios: cada N minutos se lee el inventario y el cofre de Ender de todos los jugadores
// conectados y se guarda en disco (dashboard/data/inventories/<servidor>/<jugador>.jsonl). Sirve para recuperar
// objetos perdidos por bugs, muertes raras, etc. Solo se guarda cuando algo cambio respecto a la ultima copia.

export type BackupSettings = { enabled: boolean; intervalMin: number; keepDays: number; enderChest: boolean };
export type BackupSnapshot = { at: number; player: string; items: InvSlot[]; ender: InvSlot[] };
export type BackupStatus = { running: boolean; lastRun: number | null; lastResult: string | null; nextRun: number | null; players: Record<string, number> };

const DATA = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA, "backup.json");
const DEFAULTS: BackupSettings = { enabled: false, intervalMin: 5, keepDays: 14, enderChest: true };

// Estado global para sobrevivir al hot-reload de Next en desarrollo
type G = typeof globalThis & { __exaBackup?: { timer?: ReturnType<typeof setTimeout>; status: BackupStatus; busy: boolean } };
const g = globalThis as G;
g.__exaBackup ??= { status: { running: false, lastRun: null, lastResult: null, nextRun: null, players: {} }, busy: false };
const state = g.__exaBackup;

export async function getSettings(): Promise<BackupSettings> {
  try { return { ...DEFAULTS, ...JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8")) }; } catch { return { ...DEFAULTS }; }
}

export async function saveSettings(s: Partial<BackupSettings>) {
  const next = { ...(await getSettings()), ...s };
  next.intervalMin = Math.max(1, Math.min(120, Number(next.intervalMin) || 5));
  next.keepDays = Math.max(1, Math.min(365, Number(next.keepDays) || 14));
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(next, null, 2));
  schedule();
  return next;
}

export function getStatus(): BackupStatus { return state.status; }

const safe = (s: string) => s.replace(/[^A-Za-z0-9_.-]/g, "_");
const fileFor = (serverId: string, player: string) => path.join(DATA, "inventories", safe(serverId), `${safe(player)}.jsonl`);

async function readEntityList(serverId: string, player: string, pathName: "Inventory" | "EnderItems"): Promise<InvSlot[] | null> {
  const esc = player.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const line = await queryConsole(serverId, `data get entity ${player} ${pathName}`, new RegExp(`${esc} has the following entity data: \\[`), 10000);
  const m = line?.match(/has the following entity data: (\[.*)$/);
  if (!m) return null;
  try { return parseInventory(m[1].trim()); } catch { return null; }
}

const sig = (l: InvSlot[]) => l.map((i) => `${i.slot}:${i.spec}:${i.count}`).sort().join("|");

export async function listSnapshots(serverId: string, player: string, limit = 200): Promise<BackupSnapshot[]> {
  try {
    const txt = await fs.readFile(fileFor(serverId, player), "utf8");
    const lines = txt.split("\n").filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l) as BackupSnapshot).reverse();
  } catch { return []; }
}

export async function listPlayers(serverId: string): Promise<string[]> {
  try {
    const files = await fs.readdir(path.join(DATA, "inventories", safe(serverId)));
    return files.filter((f) => f.endsWith(".jsonl")).map((f) => f.slice(0, -6));
  } catch { return []; }
}

async function appendSnapshot(serverId: string, snap: BackupSnapshot, keepDays: number) {
  const file = fileFor(serverId, snap.player);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const prev = (await listSnapshots(serverId, snap.player, 1))[0];
  if (prev && sig(prev.items) === sig(snap.items) && sig(prev.ender) === sig(snap.ender)) return false;
  await fs.appendFile(file, JSON.stringify(snap) + "\n");
  // poda por antiguedad (de vez en cuando)
  if (Math.random() < 0.1) {
    const cutoff = Date.now() - keepDays * 86400000;
    const all = await listSnapshots(serverId, snap.player, 100000);
    const keep = all.filter((s) => s.at >= cutoff).reverse();
    await fs.writeFile(file, keep.map((s) => JSON.stringify(s)).join("\n") + (keep.length ? "\n" : ""));
  }
  return true;
}

// Una pasada: lee y guarda el inventario de todos los jugadores conectados
export async function runBackup(serverId = defaultServerId()): Promise<string> {
  if (state.busy) return "Ya hay una copia en curso";
  state.busy = true;
  try {
    const settings = await getSettings();
    const server = await api.server(serverId);
    if (server.status !== 1) return "Servidor apagado";
    const players = server.players.list;
    if (!players.length) return "Sin jugadores conectados";
    let saved = 0;
    for (const p of players) {
      const items = await readEntityList(serverId, p, "Inventory");
      if (!items) continue;
      const ender = settings.enderChest ? (await readEntityList(serverId, p, "EnderItems")) ?? [] : [];
      if (await appendSnapshot(serverId, { at: Date.now(), player: p, items, ender }, settings.keepDays)) saved++;
      state.status.players[p] = Date.now();
    }
    return `${players.length} jugador(es) leidos, ${saved} copia(s) nueva(s)`;
  } catch (e) {
    return `Error: ${(e as Error).message}`;
  } finally {
    state.busy = false;
    state.status.lastRun = Date.now();
  }
}

// Programador: se reprograma tras cada pasada segun los ajustes
export async function schedule() {
  if (state.timer) { clearTimeout(state.timer); state.timer = undefined; }
  const s = await getSettings();
  state.status.running = s.enabled;
  if (!s.enabled) { state.status.nextRun = null; return; }
  const ms = s.intervalMin * 60000;
  state.status.nextRun = Date.now() + ms;
  state.timer = setTimeout(async () => {
    state.status.lastResult = await runBackup();
    schedule();
  }, ms);
}
