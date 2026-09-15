import "server-only";
import WebSocket from "ws";
import { api, defaultServerId, queryConsole } from "@/lib/exaroton";
import { db } from "@/lib/firebase";
import { promises as fs } from "node:fs";
import path from "node:path";

// Observador de consola: mantiene una conexion permanente al stream de consola del servidor por defecto y
// reacciona a eventos (sin mods):
//   - entrada/salida de jugadores -> bienvenida con titulo, historial de presencia (Firestore), Discord (webhook)
//   - muertes -> Discord
//   - mensajes automaticos cada N minutos (solo con jugadores conectados)
// Corre dentro del proceso de Next (igual que las copias automaticas). Se reconecta solo.

export type MessagesSettings = {
  welcome: { enabled: boolean; title: string; subtitle: string; chat: string; firstJoinChat: string };
  auto: { enabled: boolean; intervalMin: number; messages: string[] };
  discord: { webhook: string; joins: boolean; deaths: boolean; chat: boolean; serverStatus: boolean };
  rules: string;
};

export const DEFAULT_MESSAGES: MessagesSettings = {
  welcome: {
    enabled: true,
    title: "Bienvenido/a, {player}",
    subtitle: "Paraiso de los Degenerados",
    chat: "[Servidor] Usa /sethome para guardar tu casa, /tpa <jugador> para ir con alguien y /rules para ver las reglas.",
    firstJoinChat: "[Servidor] Es tu primera vez aqui, {player}. Escribe /rules antes de empezar. ¡Disfruta!",
  },
  auto: {
    enabled: true,
    intervalMin: 12,
    messages: [
      "Consejo: guarda tu casa con /sethome y vuelve con /home.",
      "Consejo: ¿te perdiste? /back te devuelve a donde moriste.",
      "Consejo: los cofres y bloques quedan registrados; el griefing se puede revertir.",
      "Consejo: pulsa Tab para ver las muertes de cada jugador.",
      "Consejo: /tpa <jugador> pide teletransportarte con alguien.",
    ],
  },
  discord: { webhook: "", joins: true, deaths: true, chat: false, serverStatus: true },
  rules: "1. Respeta a los demas jugadores.\n2. Nada de griefing ni robar (todo queda registrado).\n3. No uses hacks, x-ray ni exploits.\n4. No spam ni publicidad en el chat.\n5. Construye lejos del spawn y de las bases ajenas.\n6. Avisa a un admin si ves un problema.",
};

type Presence = { at: number; player: string; type: "join" | "leave" };

type State = {
  ws: WebSocket | null;
  online: Set<string>;
  connected: boolean;
  lastLine: number | null;
  reconnectTimer?: ReturnType<typeof setTimeout>;
  autoTimer?: ReturnType<typeof setInterval>;
  sampleTimer?: ReturnType<typeof setInterval>;
  autoIdx: number;
  settings: MessagesSettings | null;
  settingsAt: number;
  serverOnline: boolean;
  firstJoins: Set<string>;
  events: number;
};

type G = typeof globalThis & { __exaWatcher?: State };
const g = globalThis as G;
g.__exaWatcher ??= { ws: null, online: new Set(), connected: false, lastLine: null, autoIdx: 0, settings: null, settingsAt: 0, serverOnline: false, firstJoins: new Set(), events: 0 };
const st = g.__exaWatcher;

const DATA = path.join(process.cwd(), "data");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const fill = (t: string, player: string) => t.replaceAll("{player}", player);

// ---- Ajustes (Firestore o archivo) ----
export async function getMessages(serverId = defaultServerId()): Promise<MessagesSettings> {
  const d = db();
  if (d) {
    try { const snap = await d.collection("servers").doc(serverId).collection("meta").doc("messages").get(); return deepMerge(DEFAULT_MESSAGES, snap.data() ?? {}); } catch { /* archivo */ }
  }
  try { return deepMerge(DEFAULT_MESSAGES, JSON.parse(await fs.readFile(path.join(DATA, `messages-${serverId}.json`), "utf8"))); } catch { return structuredClone(DEFAULT_MESSAGES); }
}

export async function saveMessages(patch: Partial<MessagesSettings>, serverId = defaultServerId()) {
  const next = deepMerge(await getMessages(serverId), patch);
  next.auto.intervalMin = Math.max(1, Math.min(240, Number(next.auto.intervalMin) || 12));
  next.auto.messages = next.auto.messages.map((m) => String(m).trim()).filter(Boolean).slice(0, 50);
  const d = db();
  if (d) await d.collection("servers").doc(serverId).collection("meta").doc("messages").set(next);
  else { await fs.mkdir(DATA, { recursive: true }); await fs.writeFile(path.join(DATA, `messages-${serverId}.json`), JSON.stringify(next, null, 2)); }
  st.settings = next; st.settingsAt = Date.now();
  scheduleAuto();
  return next;
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return (patch as T) ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = b && typeof b === "object" && !Array.isArray(b) && v && typeof v === "object" && !Array.isArray(v) ? deepMerge(b, v) : v;
  }
  return out as T;
}

async function settings() {
  if (!st.settings || Date.now() - st.settingsAt > 60000) { st.settings = await getMessages(); st.settingsAt = Date.now(); }
  return st.settings;
}

// ---- Envio de comandos por la misma conexion ----
function send(cmd: string) {
  if (st.ws && st.ws.readyState === WebSocket.OPEN) st.ws.send(JSON.stringify({ stream: "console", type: "command", data: cmd }));
}

// ---- Presencia ----
async function recordPresence(e: Presence) {
  const d = db();
  const serverId = defaultServerId();
  try {
    if (d) await d.collection("servers").doc(serverId).collection("presence").add(e);
    else { await fs.mkdir(DATA, { recursive: true }); await fs.appendFile(path.join(DATA, `presence-${serverId}.jsonl`), JSON.stringify(e) + "\n"); }
  } catch { /* nunca romper el observador */ }
}

async function recordSample() {
  const d = db();
  const serverId = defaultServerId();
  const s = { at: Date.now(), count: st.online.size, players: [...st.online], online: st.serverOnline };
  try {
    if (d) await d.collection("servers").doc(serverId).collection("samples").add(s);
    else { await fs.mkdir(DATA, { recursive: true }); await fs.appendFile(path.join(DATA, `samples-${serverId}.jsonl`), JSON.stringify(s) + "\n"); }
  } catch { /* ignorar */ }
}

export async function listPresence(serverId: string, since: number): Promise<{ events: Presence[]; samples: { at: number; count: number; players: string[]; online: boolean }[] }> {
  const d = db();
  if (d) {
    const [e, s] = await Promise.all([
      d.collection("servers").doc(serverId).collection("presence").where("at", ">=", since).orderBy("at", "desc").limit(2000).get(),
      d.collection("servers").doc(serverId).collection("samples").where("at", ">=", since).orderBy("at", "asc").limit(5000).get(),
    ]);
    return { events: e.docs.map((x) => x.data() as Presence), samples: s.docs.map((x) => x.data() as { at: number; count: number; players: string[]; online: boolean }) };
  }
  const read = async <T,>(f: string) => { try { return (await fs.readFile(path.join(DATA, f), "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l) as T).filter((x) => (x as { at: number }).at >= since); } catch { return [] as T[]; } };
  return { events: (await read<Presence>(`presence-${serverId}.jsonl`)).reverse(), samples: await read(`samples-${serverId}.jsonl`) };
}

// ---- Discord ----
async function discord(text: string, kind: "joins" | "deaths" | "chat" | "serverStatus") {
  const s = await settings();
  if (!s.discord.webhook || !s.discord[kind]) return;
  try {
    await fetch(s.discord.webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text.slice(0, 1900), allowed_mentions: { parse: [] } }) });
  } catch { /* ignorar */ }
}

// ---- Manejo de lineas ----
const RE_JOIN = /^\[[^\]]*\] \[[^\]]*\]: (\S+)\[\/[^\]]*\] logged in with entity id/;
const RE_LEAVE = /^\[[^\]]*\] \[[^\]]*\]: (\S+) lost connection: /;
const RE_CHAT = /^\[[^\]]*\] \[[^\]]*\]: <(\S+)> (.*)$/;
const RE_DONE = /^\[[^\]]*\] \[[^\]]*\]: Done \(/;
const RE_STOP = /^\[[^\]]*\] \[[^\]]*\]: Stopping (the )?server/;

async function onLine(line: string) {
  st.lastLine = Date.now();
  let m: RegExpMatchArray | null;
  if ((m = line.match(RE_JOIN))) {
    const player = m[1];
    const first = !st.online.has(player) && !(await hasPlayedBefore(player));
    st.online.add(player); st.events++;
    await recordPresence({ at: Date.now(), player, type: "join" });
    await discord(`🟢 **${player}** entró al servidor (${st.online.size} en línea)`, "joins");
    const s = await settings();
    if (s.welcome.enabled) setTimeout(() => {
      send(`title ${player} times 10 70 20`);
      if (s.welcome.subtitle) send(`title ${player} subtitle {"text":"${esc(fill(s.welcome.subtitle, player))}","color":"gray"}`);
      if (s.welcome.title) send(`title ${player} title {"text":"${esc(fill(s.welcome.title, player))}","color":"green","bold":true}`);
      const chat = first && s.welcome.firstJoinChat ? s.welcome.firstJoinChat : s.welcome.chat;
      if (chat) send(`tellraw ${player} {"text":"${esc(fill(chat, player))}","color":"gray"}`);
    }, 2500);
    return;
  }
  if ((m = line.match(RE_LEAVE))) {
    const player = m[1];
    if (st.online.delete(player)) { st.events++; await recordPresence({ at: Date.now(), player, type: "leave" }); await discord(`🔴 **${player}** salió del servidor (${st.online.size} en línea)`, "joins"); }
    return;
  }
  if ((m = line.match(RE_CHAT))) { await discord(`**${m[1]}**: ${m[2]}`, "chat"); return; }
  if (RE_DONE.test(line)) { st.serverOnline = true; await discord("✅ El servidor está en línea", "serverStatus"); await syncOnline(); return; }
  if (RE_STOP.test(line)) { st.serverOnline = false; st.online.clear(); await discord("⏹️ El servidor se está apagando", "serverStatus"); return; }
  // muertes: linea de broadcast con un jugador conectado como primera palabra y sin ser chat/comando
  const death = line.match(/^\[[^\]]*\] \[Server thread\/INFO\]: (\S+) (was|died|drowned|blew up|fell|hit the ground|went up in flames|burned|tried to swim|suffocated|starved|withered|froze|experienced|walked into|discovered|was killed|was slain|was shot|was fireballed|was pummeled|was impaled|was squashed|was struck|was poked|was stung|was skewered|was doomed|was obliterated|left the confines|didn.t want|was roasted|was frozen)/);
  if (death && st.online.has(death[1])) await discord(`☠️ ${line.replace(/^\[[^\]]*\] \[[^\]]*\]: /, "")}`, "deaths");
}

async function hasPlayedBefore(player: string) {
  if (st.firstJoins.has(player)) return true;
  const d = db();
  try {
    if (d) { const q = await d.collection("servers").doc(defaultServerId()).collection("presence").where("player", "==", player).limit(1).get(); if (!q.empty) { st.firstJoins.add(player); return true; } }
  } catch { /* asumir que si */ return true; }
  st.firstJoins.add(player);
  return false;
}

// Estado inicial de conectados desde la API (por si el observador arranco con jugadores dentro)
async function syncOnline() {
  try {
    const s = await api.server(defaultServerId());
    st.serverOnline = s.status === 1;
    st.online = new Set(s.players.list);
  } catch { /* ignorar */ }
}

// ---- Mensajes automaticos ----
function scheduleAuto() {
  if (st.autoTimer) { clearInterval(st.autoTimer); st.autoTimer = undefined; }
  const s = st.settings; if (!s?.auto.enabled || !s.auto.messages.length) return;
  st.autoTimer = setInterval(async () => {
    const cur = await settings();
    if (!cur.auto.enabled || !cur.auto.messages.length || !st.serverOnline || st.online.size === 0 || !st.connected) return;
    const msg = cur.auto.messages[st.autoIdx % cur.auto.messages.length]; st.autoIdx++;
    send(`tellraw @a [{"text":"[Servidor] ","color":"green"},{"text":"${esc(msg)}","color":"gray"}]`);
  }, s.auto.intervalMin * 60000);
}

// ---- Conexion ----
function connect() {
  const id = defaultServerId();
  const tok = process.env.EXAROTON_TOKEN;
  if (!id || !tok) return;
  if (st.ws) { try { st.ws.close(); } catch {} st.ws = null; }
  const ws = new WebSocket(`wss://api.exaroton.com/v1/servers/${id}/websocket`, { headers: { Authorization: `Bearer ${tok}` } });
  st.ws = ws;
  ws.on("open", () => { st.connected = true; });
  ws.on("message", (raw) => {
    let msg: { type: string; stream?: string; data?: unknown };
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === "ready") { ws.send(JSON.stringify({ stream: "console", type: "start", data: { tail: 0 } })); syncOnline(); }
    else if (msg.stream === "console" && msg.type === "line") onLine(String(msg.data).trimEnd()).catch(() => {});
    else if (msg.type === "status") { const s = msg.data as { status?: number }; if (typeof s?.status === "number") { st.serverOnline = s.status === 1; if (!st.serverOnline) st.online.clear(); } }
  });
  const retry = () => { st.connected = false; if (st.reconnectTimer) clearTimeout(st.reconnectTimer); st.reconnectTimer = setTimeout(connect, 15000); };
  ws.on("close", retry);
  ws.on("error", retry);
}

export async function startWatcher() {
  if (st.connected || st.ws) return;
  await settings();
  connect();
  scheduleAuto();
  if (!st.sampleTimer) st.sampleTimer = setInterval(recordSample, 5 * 60000);
}

export function watcherStatus() {
  return { connected: st.connected, serverOnline: st.serverOnline, online: [...st.online], lastLine: st.lastLine, events: st.events, autoEnabled: !!st.settings?.auto.enabled };
}

// Ejecuta un comando a traves de la conexion del observador (util para pruebas desde el panel)
export async function sendViaWatcher(cmd: string) { send(cmd); }

// Exportado para pruebas de bienvenida desde el panel
export async function previewWelcome(player: string) {
  const s = await settings();
  const cmds = [`title ${player} times 10 70 20`];
  if (s.welcome.subtitle) cmds.push(`title ${player} subtitle {"text":"${esc(fill(s.welcome.subtitle, player))}","color":"gray"}`);
  if (s.welcome.title) cmds.push(`title ${player} title {"text":"${esc(fill(s.welcome.title, player))}","color":"green","bold":true}`);
  if (s.welcome.chat) cmds.push(`tellraw ${player} {"text":"${esc(fill(s.welcome.chat, player))}","color":"gray"}`);
  await queryConsole(defaultServerId(), cmds, /$^/, 1500).catch(() => null);
}
