import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { api, defaultServerId, queryConsoleLines } from "@/lib/exaroton";
import { db } from "@/lib/firebase";
import { notifyAlert, sendViaWatcher } from "@/lib/watcher";

// Operacion automatica del servidor: reinicios programados (con avisos en el juego) y vigilancia del TPS.
// Corre dentro del proceso de Next (igual que las copias). Ajustes en Firestore (settings/ops) o data/ops.json.

export type OpsSettings = {
  restart: { enabled: boolean; times: string[]; warnMin: number[]; reason: string }; // times "HH:MM" en la hora local del panel
  tps: { enabled: boolean; threshold: number; everyMin: number };
};
export type OpsStatus = { lastRestart: number | null; lastTps: number | null; lastTpsAt: number | null; nextRestart: number | null; log: { at: number; text: string }[] };

const DEFAULTS: OpsSettings = {
  restart: { enabled: false, times: ["05:00"], warnMin: [10, 5, 1], reason: "Reinicio programado" },
  tps: { enabled: false, threshold: 15, everyMin: 2 },
};
const FILE = path.join(process.cwd(), "data", "ops.json");

type G = typeof globalThis & { __exaOps?: { timer?: ReturnType<typeof setInterval>; status: OpsStatus; done: Set<string>; lowTps: number; lastTpsCheck: number } };
const g = globalThis as G;
g.__exaOps ??= { status: { lastRestart: null, lastTps: null, lastTpsAt: null, nextRestart: null, log: [] }, done: new Set(), lowTps: 0, lastTpsCheck: 0 };
const state = g.__exaOps;

const note = (text: string) => { state.status.log = [{ at: Date.now(), text }, ...state.status.log].slice(0, 30); };

export async function getOps(): Promise<OpsSettings> {
  const merge = (x: Partial<OpsSettings> | undefined): OpsSettings => ({ restart: { ...DEFAULTS.restart, ...(x?.restart ?? {}) }, tps: { ...DEFAULTS.tps, ...(x?.tps ?? {}) } });
  const d = db();
  if (d) { try { return merge((await d.collection("settings").doc("ops").get()).data() as Partial<OpsSettings>); } catch { /* cae a archivo */ } }
  try { return merge(JSON.parse(await fs.readFile(FILE, "utf8"))); } catch { return merge(undefined); }
}

export async function saveOps(patch: Partial<OpsSettings>): Promise<OpsSettings> {
  const cur = await getOps();
  const next: OpsSettings = { restart: { ...cur.restart, ...(patch.restart ?? {}) }, tps: { ...cur.tps, ...(patch.tps ?? {}) } };
  next.restart.times = [...new Set(next.restart.times.map((t) => String(t).trim()).filter((t) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(t)).map((t) => t.padStart(5, "0")))].sort();
  next.restart.warnMin = [...new Set(next.restart.warnMin.map(Number).filter((n) => n >= 1 && n <= 60))].sort((a, b) => b - a);
  next.tps.threshold = Math.max(5, Math.min(19.5, Number(next.tps.threshold) || 15));
  next.tps.everyMin = Math.max(1, Math.min(30, Number(next.tps.everyMin) || 2));
  const d = db();
  if (d) await d.collection("settings").doc("ops").set(next);
  else { await fs.mkdir(path.dirname(FILE), { recursive: true }); await fs.writeFile(FILE, JSON.stringify(next, null, 2)); }
  state.status.nextRestart = nextRestartAt(next);
  start();
  return next;
}

export function getOpsStatus(): OpsStatus { return state.status; }

function nextRestartAt(s: OpsSettings): number | null {
  if (!s.restart.enabled || !s.restart.times.length) return null;
  const now = new Date();
  const c = s.restart.times.map((t) => { const [h, m] = t.split(":").map(Number); const d = new Date(now); d.setHours(h, m, 0, 0); if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1); return d.getTime(); });
  return Math.min(...c);
}

const say = (text: string) => sendViaWatcher(`tellraw @a {"text":"[Servidor] ${text.replace(/["\\]/g, "")}","color":"yellow"}`);

async function tick() {
  try {
    const s = await getOps();
    const id = defaultServerId();
    const now = new Date();
    state.status.nextRestart = nextRestartAt(s);
    if (s.restart.enabled && id) {
      const server = await api.server(id);
      if (server.status === 1) {
        for (const t of s.restart.times) {
          const [h, m] = t.split(":").map(Number);
          const at = new Date(now); at.setHours(h, m, 0, 0);
          const left = Math.round((at.getTime() - now.getTime()) / 60000); // minutos que faltan para ese reinicio (hoy)
          const day = now.toDateString();
          for (const w of s.restart.warnMin) {
            const key = `${day}|${t}|warn${w}`;
            if (left === w && !state.done.has(key)) { state.done.add(key); await say(`${s.restart.reason}: el servidor se reinicia en ${w} minuto${w > 1 ? "s" : ""}. Guarda lo que estes haciendo.`); note(`Aviso de reinicio en ${w} min (${t})`); }
          }
          const key = `${day}|${t}|go`;
          if (left <= 0 && left > -2 && !state.done.has(key)) {
            state.done.add(key);
            await say("Reiniciando ahora…");
            await sendViaWatcher("save-all");
            await new Promise((r) => setTimeout(r, 4000));
            await api.restart(id);
            state.status.lastRestart = Date.now();
            note(`Reinicio programado ejecutado (${t})`);
            await notifyAlert("🔄 Reinicio programado", `El servidor se esta reiniciando (${t}).`, [], 0x8a8f98);
          }
        }
        if (state.done.size > 200) state.done.clear();
      }
    }
    if (s.tps.enabled && id && Date.now() - state.lastTpsCheck >= s.tps.everyMin * 60000) {
      state.lastTpsCheck = Date.now();
      const server = await api.server(id);
      if (server.status === 1 && server.players.count > 0) {
        const lines = await queryConsoleLines(id, ["spark tps"], 1500, 8000).catch(() => [] as string[]);
        const line = lines.find((l) => /TPS from last/i.test(l));
        const nums = line ? [...line.replace(/§./g, "").split(":").slice(1).join(":").matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])) : [];
        const tps = nums[2] ?? nums[0]; // media de 1 min (o la primera disponible)
        if (tps != null) {
          state.status.lastTps = tps; state.status.lastTpsAt = Date.now();
          if (tps < s.tps.threshold) {
            state.lowTps++;
            if (state.lowTps === 2) { await notifyAlert("🐌 TPS bajo", `El servidor va a **${tps.toFixed(1)} TPS** (umbral ${s.tps.threshold}). Jugadores: ${server.players.list.join(", ")}`, [], 0xff5555); note(`TPS bajo: ${tps}`); }
          } else state.lowTps = 0;
        }
      }
    }
  } catch { /* se reintenta en el siguiente ciclo */ }
}

export function start() {
  if (state.timer) return;
  state.timer = setInterval(tick, 30000);
  tick();
}
