import "server-only";
import { readPlayerList } from "@/lib/player-inventory";
import { promises as fs } from "node:fs";
import path from "node:path";
import { api, defaultServerId } from "@/lib/exaroton";
import { type InvSlot } from "@/lib/snbt";
import { db } from "@/lib/firebase";
import { notifyAlert } from "@/lib/watcher";

// Copias automaticas de inventarios: cada N minutos se lee el inventario y el cofre de Ender de todos los jugadores
// conectados y se guarda en Firestore (servers/<id>/players/<jugador>/snapshots) o, si no esta configurado,
// en disco (dashboard/data/inventories/<servidor>/<jugador>.jsonl). Sirve para recuperar
// objetos perdidos por bugs, muertes raras, etc. Solo se guarda cuando algo cambio respecto a la ultima copia.

export type BackupSettings = { enabled: boolean; intervalMin: number; keepDays: number; enderChest: boolean };
export type BackupSnapshot = { at: number; player: string; items: InvSlot[]; ender: InvSlot[] };
export type BackupStatus = { running: boolean; lastRun: number | null; lastResult: string | null; nextRun: number | null; players: Record<string, number>; alerts?: LossAlert[] };
export type LossAlert = { at: number; player: string; lost: number; units: number; names: string[] };

const DATA = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA, "backup.json");
const DEFAULTS: BackupSettings = { enabled: false, intervalMin: 5, keepDays: 14, enderChest: true };

// Estado global para sobrevivir al hot-reload de Next en desarrollo
type G = typeof globalThis & { __exaBackup?: { timer?: ReturnType<typeof setTimeout>; status: BackupStatus; busy: boolean } };
const g = globalThis as G;
g.__exaBackup ??= { status: { running: false, lastRun: null, lastResult: null, nextRun: null, players: {} }, busy: false };
const state = g.__exaBackup;

export async function getSettings(): Promise<BackupSettings> {
  const d = db();
  if (d) {
    try { const snap = await d.collection("settings").doc("backup").get(); return { ...DEFAULTS, ...(snap.data() ?? {}) }; } catch { /* cae a archivo */ }
  }
  try { return { ...DEFAULTS, ...JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8")) }; } catch { return { ...DEFAULTS }; }
}

export async function saveSettings(s: Partial<BackupSettings>) {
  const next = { ...(await getSettings()), ...s };
  next.intervalMin = Math.max(1, Math.min(120, Number(next.intervalMin) || 5));
  next.keepDays = Math.max(1, Math.min(365, Number(next.keepDays) || 14));
  const d = db();
  if (d) await d.collection("settings").doc("backup").set(next);
  else { await fs.mkdir(DATA, { recursive: true }); await fs.writeFile(SETTINGS_FILE, JSON.stringify(next, null, 2)); }
  schedule();
  return next;
}

export function getStatus(): BackupStatus { return state.status; }

const safe = (s: string) => s.replace(/[^A-Za-z0-9_.-]/g, "_");
const fileFor = (serverId: string, player: string) => path.join(DATA, "inventories", safe(serverId), `${safe(player)}.jsonl`);

async function readEntityList(serverId: string, player: string, pathName: "Inventory" | "EnderItems"): Promise<InvSlot[] | null> {
  try { return (await readPlayerList(serverId, player, pathName))?.slots ?? null; } catch { return null; }
}

const sig = (l: InvSlot[]) => l.map((i) => `${i.slot}:${i.spec}:${i.count}`).sort().join("|");

const col = (serverId: string, player: string) => db()!.collection("servers").doc(serverId).collection("players").doc(player.toLowerCase()).collection("snapshots");

export async function listSnapshots(serverId: string, player: string, limit = 200): Promise<BackupSnapshot[]> {
  if (db()) {
    const q = await col(serverId, player).orderBy("at", "desc").limit(limit).get();
    return q.docs.map((d) => d.data() as BackupSnapshot);
  }
  try {
    const txt = await fs.readFile(fileFor(serverId, player), "utf8");
    const lines = txt.split("\n").filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l) as BackupSnapshot).reverse();
  } catch { return []; }
}

export async function listPlayers(serverId: string): Promise<string[]> {
  if (db()) {
    const q = await db()!.collection("servers").doc(serverId).collection("players").get();
    return q.docs.map((d) => (d.data().name as string) ?? d.id);
  }
  try {
    const files = await fs.readdir(path.join(DATA, "inventories", safe(serverId)));
    return files.filter((f) => f.endsWith(".jsonl")).map((f) => f.slice(0, -6));
  } catch { return []; }
}

async function appendSnapshot(serverId: string, snap: BackupSnapshot, keepDays: number) {
  if (db()) {
    const prev = (await listSnapshots(serverId, snap.player, 1))[0];
    if (prev && sig(prev.items) === sig(snap.items) && sig(prev.ender) === sig(snap.ender)) return false;
    const playerDoc = db()!.collection("servers").doc(serverId).collection("players").doc(snap.player.toLowerCase());
    await playerDoc.set({ name: snap.player, lastSnapshot: snap.at }, { merge: true });
    await col(serverId, snap.player).add(snap);
    if (Math.random() < 0.1) {
      const old = await col(serverId, snap.player).where("at", "<", Date.now() - keepDays * 86400000).limit(200).get();
      const batch = db()!.batch(); old.docs.forEach((d) => batch.delete(d.ref)); await batch.commit();
    }
    return true;
  }
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

// Deteccion de perdida masiva: si respecto a la copia anterior desaparecen muchos objetos de golpe (muerte sin keepInventory,
// bug, robo...) se avisa por Discord y queda en el panel, para recuperar a tiempo desde la copia anterior.
const LOSS_MIN_ITEMS = 8;
async function checkLoss(serverId: string, snap: BackupSnapshot) {
  const prev = (await listSnapshots(serverId, snap.player, 1))[0];
  if (!prev) return;
  const have = new Map<string, number>();
  for (const i of snap.items) have.set(i.spec, (have.get(i.spec) ?? 0) + i.count);
  const lost: InvSlot[] = [];
  for (const i of prev.items) { const h = have.get(i.spec) ?? 0; const take = Math.min(i.count, h); have.set(i.spec, h - take); if (i.count - take > 0) lost.push({ ...i, count: i.count - take }); }
  const units = lost.reduce((a, i) => a + i.count, 0);
  if (lost.length < LOSS_MIN_ITEMS) return;
  const names = lost.slice(0, 8).map((i) => `${i.id.replace(/^minecraft:/, "")} x${i.count}`);
  (state.status.alerts ??= []).unshift({ at: snap.at, player: snap.player, lost: lost.length, units, names });
  state.status.alerts = state.status.alerts.slice(0, 20);
  await notifyAlert("📉 Perdida masiva de objetos", `**${snap.player}** perdio ${lost.length} objetos (${units} unidades) desde la copia anterior. Se pueden devolver desde Comandos → Inventario → Recuperar objetos.`, [{ name: "Ejemplos", value: names.join(", ").slice(0, 900) || "—" }], 0xff5555);
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
      const snap = { at: Date.now(), player: p, items, ender };
      await checkLoss(serverId, snap).catch(() => {});
      if (await appendSnapshot(serverId, snap, settings.keepDays)) saved++;
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
