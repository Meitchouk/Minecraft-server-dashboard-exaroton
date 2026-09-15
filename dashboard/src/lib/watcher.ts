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
  discord: {
    webhook: string; joins: boolean; deaths: boolean; chat: boolean; serverStatus: boolean; mentionEveryone: boolean;
    name: string; avatar: string; serverName: string; address: string;
    gifs: { join: string; leave: string; death: string; online: string; offline: string };
    giphy: { apiKey: string; auto: boolean; rating: "g" | "pg" | "pg-13" | "r"; terms: { join: string; leave: string; death: string; online: string; offline: string } };
  };
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
  discord: {
    webhook: "", joins: true, deaths: true, chat: false, serverStatus: true, mentionEveryone: true,
    name: "Paraíso de los Degenerados", avatar: "https://mc-heads.net/head/MHF_Steve/128", serverName: "Paraíso de los Degenerados", address: "56ibarra89.exaroton.me",
    gifs: { join: "", leave: "", death: "", online: "", offline: "" },
    giphy: { apiKey: "", auto: true, rating: "pg-13", terms: { join: "minecraft welcome", leave: "bye bye", death: "minecraft death", online: "lets go party", offline: "good night" } },
  },
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
  statusKnown: boolean;           // ya conocemos el estado real (evita avisar al (re)conectar)
  lastStatusNotice: { online: boolean; at: number } | null; // ultimo aviso enviado a Discord
  firstJoins: Set<string>;
  events: number;
  debug: { msgs: number; lines: number; stale: number; readyState: number | null; connects: number };
};

type G = typeof globalThis & { __exaWatcher?: State };
const g = globalThis as G;
g.__exaWatcher ??= { ws: null, online: new Set(), connected: false, lastLine: null, autoIdx: 0, settings: null, settingsAt: 0, serverOnline: false, statusKnown: false, lastStatusNotice: null, firstJoins: new Set(), events: 0, debug: { msgs: 0, lines: 0, stale: 0, readyState: null, connects: 0 } };
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

// ---- Discord (webhook con embeds) ----
type Kind = "joins" | "deaths" | "chat" | "serverStatus";
type Embed = { title?: string; description?: string; color?: number; thumbnail?: { url: string }; image?: { url: string }; fields?: { name: string; value: string; inline?: boolean }[]; footer?: { text: string; icon_url?: string }; author?: { name: string; icon_url?: string }; timestamp?: string };

const C = { green: 0x5eff7a, red: 0xff5555, gray: 0x8a8f98, gold: 0xffc107, purple: 0xb388ff };
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const avatar = (p: string) => `https://mc-heads.net/avatar/${encodeURIComponent(p)}/64`;
const body = (p: string) => `https://mc-heads.net/body/${encodeURIComponent(p)}/120`;
// Lineas con la tematica del servidor (aleatorias)
const FLAVOR = {
  join: ["Un degenerado más cruza las puertas del paraíso.", "El paraíso abre sus puertas a otra alma perdida.", "Que empiece la degeneración.", "Llegó a pecar, como todos.", "Bienvenido/a al único paraíso donde todo está permitido (menos el grief)."],
  leave: ["Abandona el paraíso… por ahora.", "Se fue a hacer cosas de persona normal.", "El paraíso lo verá volver, siempre vuelven.", "Salió a tomar aire fresco."],
  death: ["El paraíso reclama un alma.", "Nadie dijo que el paraíso fuera seguro.", "F en el chat.", "Un degenerado menos… hasta que reaparezca.", "La muerte también es parte de la experiencia."],
  online: ["Las puertas del paraíso están abiertas.", "El paraíso despierta. ¿Quién se apunta?", "Servidor listo: a degenerar se ha dicho."],
  offline: ["El paraíso cierra por hoy.", "Se apagan las luces del paraíso.", "Descanso obligatorio."],
};

async function post(payload: Record<string, unknown>) {
  const s = await settings();
  if (!s.discord.webhook) return;
  try {
    await fetch(s.discord.webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: s.discord.name || undefined, avatar_url: s.discord.avatar || undefined, allowed_mentions: { parse: [] }, ...payload }) });
  } catch { /* ignorar */ }
}

async function discord(text: string, kind: Kind, mentionEveryone = false) {
  const s = await settings();
  if (!s.discord.webhook || !s.discord[kind]) return;
  const mention = mentionEveryone && s.discord.mentionEveryone;
  await post({ content: (mention ? "@everyone " : "") + text.slice(0, 1900), allowed_mentions: { parse: mention ? ["everyone"] : [] } });
}

async function discordEmbed(kind: Kind, embed: Embed, opts: { mention?: boolean; content?: string } = {}) {
  const s = await settings();
  if (!s.discord.webhook || !s.discord[kind]) return;
  const mention = !!opts.mention && s.discord.mentionEveryone;
  const footer = { text: s.discord.serverName || "Servidor", icon_url: s.discord.avatar || undefined };
  await post({ content: (mention ? "@everyone " : "") + (opts.content ?? ""), allowed_mentions: { parse: mention ? ["everyone"] : [] }, embeds: [{ footer, timestamp: new Date().toISOString(), ...embed }] });
}

const gifOf = async (k: keyof MessagesSettings["discord"]["gifs"]) => {
  const s = await settings();
  const g = s.discord.gifs[k]?.trim();
  if (g) { const list = g.split(/\s+/).filter(Boolean); return { url: pick(list) }; }
  const gp = s.discord.giphy;
  if (gp.auto && gp.apiKey && gp.terms[k]) { const url = await giphyRandom(gp.apiKey, gp.terms[k], gp.rating); if (url) return { url }; }
  return undefined;
};

// GIF aleatorio de Giphy por tema (endpoint /random). Devuelve la URL directa del gif o null.
export async function giphyRandom(apiKey: string, tag: string, rating = "pg-13"): Promise<string | null> {
  try {
    const r = await fetch(`https://api.giphy.com/v1/gifs/random?api_key=${encodeURIComponent(apiKey)}&tag=${encodeURIComponent(tag)}&rating=${rating}`);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data?.images?.original?.url ?? j?.data?.images?.downsized?.url ?? null;
  } catch { return null; }
}

// Busqueda para el selector de GIFs del panel
export async function giphySearch(apiKey: string, q: string, rating = "pg-13", limit = 24) {
  const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}&rating=${rating}&limit=${limit}&lang=es`);
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "API key de Giphy invalida" : `Giphy respondió ${r.status}`);
  const j = await r.json();
  return (j.data as { id: string; title: string; images: { original: { url: string }; fixed_height_small: { url: string } } }[]).map((g) => ({ id: g.id, title: g.title, url: g.images.original.url, preview: g.images.fixed_height_small.url }));
}

export async function notifyJoin(player: string, first: boolean) {
  await discordEmbed("joins", {
    author: { name: `${player} entró al paraíso`, icon_url: avatar(player) },
    description: first ? `🌟 **¡Primera vez aquí!** ${pick(FLAVOR.join)}` : pick(FLAVOR.join),
    color: C.green, thumbnail: { url: body(player) },
    fields: [{ name: "En línea ahora", value: `${st.online.size} · ${[...st.online].join(", ") || "—"}`, inline: false }],
    image: await gifOf("join"),
  });
}
export async function notifyLeave(player: string) {
  await discordEmbed("joins", { author: { name: `${player} salió del paraíso`, icon_url: avatar(player) }, description: pick(FLAVOR.leave), color: C.gray, fields: [{ name: "Quedan", value: `${st.online.size} · ${[...st.online].join(", ") || "nadie"}` }], image: await gifOf("leave") });
}
export async function notifyDeath(player: string, message: string) {
  await discordEmbed("deaths", { author: { name: "☠️ " + pick(FLAVOR.death), icon_url: avatar(player) }, title: message, color: C.red, thumbnail: { url: body(player) }, image: await gifOf("death") });
}
export async function notifyStatus(online: boolean, crashed = false) {
  const s = await settings();
  if (online) {
    let info: { name?: string; software?: { name: string; version: string } | null; players?: { max: number } } = {};
    try { info = await api.server(defaultServerId()); } catch { /* sin datos */ }
    await discordEmbed("serverStatus", {
      title: "🟢 " + pick(FLAVOR.online), color: C.green,
      description: `Conéctate a **${s.discord.address || "—"}**`,
      fields: [
        { name: "Versión", value: info.software ? `${info.software.name} ${info.software.version}` : "—", inline: true },
        { name: "Slots", value: String(info.players?.max ?? "—"), inline: true },
        { name: "Extras", value: "/home · /tpa · Waystones · Kit inicial", inline: false },
      ],
      image: await gifOf("online"),
    }, { mention: true });
  } else {
    await discordEmbed("serverStatus", { title: crashed ? "💥 El servidor se ha caído" : "⏹️ " + pick(FLAVOR.offline), color: crashed ? C.red : C.gray, description: crashed ? "Se reiniciará solo o lo levantará un admin." : "Cualquier jugador aprobado puede encenderlo desde el panel.", image: await gifOf("offline") });
  }
}

// ---- Idempotencia ----
// Cada evento se reclama una sola vez en Firestore (servers/<id>/notified/<clave>, creado con create(), que falla si ya
// existe). Asi, aunque haya dos procesos del panel (dev + produccion, un reinicio a medias, dos pestañas del servidor
// de Next...) o la consola repita una linea, cada aviso a Discord y cada bienvenida salen UNA vez.
const claimed = new Map<string, number>(); // respaldo en memoria si no hay Firestore
async function claim(key: string): Promise<boolean> {
  const k = key.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 400);
  const now = Date.now();
  for (const [kk, t] of claimed) if (now - t > 3600000) claimed.delete(kk);
  if (claimed.has(k)) return false;
  claimed.set(k, now);
  const d = db();
  if (!d) return true;
  try {
    await d.collection("servers").doc(defaultServerId()).collection("notified").doc(k).create({ at: now });
    return true;
  } catch (e) {
    const code = (e as { code?: number | string }).code;
    if (code === 6 || code === "already-exists" || /ALREADY_EXISTS/i.test(String((e as Error).message))) return false;
    return true; // otro error de Firestore: mejor avisar que callar
  }
}
// Clave estable para una linea de consola: su hora [hh:mm:ss] + texto sin el prefijo de hilo
const lineKey = (scope: string, line: string) => `${scope}:${line.replace(/^(\[[^\]]*\]) \[[^\]]*\]: /, "$1 ").slice(0, 300)}`;

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
    if (!(await claim(lineKey("join", line)))) return; // otro proceso ya lo atendio
    await recordPresence({ at: Date.now(), player, type: "join" });
    await notifyJoin(player, first);
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
    if (st.online.delete(player) && (await claim(lineKey("leave", line)))) { st.events++; await recordPresence({ at: Date.now(), player, type: "leave" }); await notifyLeave(player); }
    return;
  }
  if ((m = line.match(RE_CHAT))) { if (await claim(lineKey("chat", line))) await discord(`**${m[1]}**: ${m[2]}`, "chat"); return; }
  if (RE_DONE.test(line)) { applyStatus(true); await syncOnline(); return; }
  if (RE_STOP.test(line)) { applyStatus(false); return; }
  // muertes: linea de broadcast con un jugador conectado como primera palabra y sin ser chat/comando
  // Styled Chat antepone "[☠] " al mensaje de muerte: se admite un prefijo entre corchetes opcional
  const death = line.match(/^\[[^\]]*\] \[Server thread\/INFO\]: (?:\[[^\]]*\] )?(\S+) (was|died|drowned|blew up|fell|hit the ground|went up in flames|burned|tried to swim|suffocated|starved|withered|froze|experienced|walked into|discovered|was killed|was slain|was shot|was fireballed|was pummeled|was impaled|was squashed|was struck|was poked|was stung|was skewered|was doomed|was obliterated|left the confines|didn.t want|was roasted|was frozen)/);
  if (death && st.online.has(death[1]) && (await claim(lineKey("death", line)))) await notifyDeath(death[1], line.replace(/^\[[^\]]*\] \[[^\]]*\]: (?:\[[^\]]*\] )?/, ""));
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
    applyStatus(s.status === 1, { silent: true });
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
    if (!(await claim(`auto:${Math.floor(Date.now() / (cur.auto.intervalMin * 60000))}`))) return;
    send(`tellraw @a [{"text":"[Servidor] ","color":"green"},{"text":"${esc(msg)}","color":"gray"}]`);
  }, s.auto.intervalMin * 60000);
}

// Unica via para cambiar el estado en linea/apagado. Avisa a Discord solo si el estado CAMBIA de verdad
// (no al conectar o sincronizar) y nunca repite el mismo aviso en 10 min.
function applyStatus(online: boolean, opts: { crashed?: boolean; silent?: boolean } = {}) {
  const changed = st.statusKnown && online !== st.serverOnline;
  st.serverOnline = online;
  st.statusKnown = true;
  if (!online) st.online.clear();
  if (opts.silent || !changed) return;
  const last = st.lastStatusNotice;
  if (last && last.online === online && Date.now() - last.at < 10 * 60000) return;
  st.lastStatusNotice = { online, at: Date.now() };
  claim(`status:${online ? "online" : "offline"}:${Math.floor(Date.now() / 60000)}`).then((ok) => { if (ok) return notifyStatus(online, !!opts.crashed); }).catch(() => {});
}

// ---- Conexion ----
function connect() {
  const id = defaultServerId();
  const tok = process.env.EXAROTON_TOKEN;
  if (!id || !tok) return;
  if (st.ws) { const old = st.ws; st.ws = null; old.removeAllListeners(); try { old.close(); } catch {} }
  const ws = new WebSocket(`wss://api.exaroton.com/v1/servers/${id}/websocket`, { headers: { Authorization: `Bearer ${tok}` } });
  st.ws = ws;
  st.debug.connects++;
  const alive = () => st.ws === ws; // ignora eventos de sockets viejos
  ws.on("open", () => { if (alive()) st.connected = true; });
  ws.on("message", (raw) => {
    st.debug.msgs++;
    if (!alive()) { st.debug.stale++; return; }
    let msg: { type: string; stream?: string; data?: unknown };
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === "ready") { ws.send(JSON.stringify({ stream: "console", type: "start", data: { tail: 0 } })); syncOnline(); }
    else if (msg.stream === "console" && msg.type === "line") { st.debug.lines++; onLine(String(msg.data).trimEnd()).catch(() => {}); }
    else if (msg.type === "status") {
      const s = msg.data as { status?: number; players?: { list?: string[] } };
      if (typeof s?.status !== "number") return;
      const online = s.status === 1;
      if (online && s.players?.list) st.online = new Set(s.players.list);
      applyStatus(online, { crashed: s.status === 7 });
    }
  });
  const retry = () => { if (!alive()) return; st.connected = false; if (st.reconnectTimer) clearTimeout(st.reconnectTimer); st.reconnectTimer = setTimeout(connect, 15000); };
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
  return { connected: st.connected, serverOnline: st.serverOnline, online: [...st.online], lastLine: st.lastLine, events: st.events, autoEnabled: !!st.settings?.auto.enabled, debug: { ...st.debug, readyState: st.ws?.readyState ?? null } };
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

// Envia un mensaje de prueba al webhook configurado (o al que se pase)
export async function testDiscord(webhook?: string) {
  const url = webhook?.trim() || (await settings()).discord.webhook;
  if (!url) throw new Error("No hay webhook configurado");
  const s = await settings();
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: s.discord.name || undefined, avatar_url: s.discord.avatar || undefined, embeds: [{ title: "✅ Webhook conectado", description: pick(FLAVOR.online) + "\nAsí se verán los avisos: tarjetas con la skin del jugador, color por evento y GIF si lo configuras.", color: C.green, thumbnail: { url: body("Meitchouk") }, footer: { text: s.discord.serverName || "Servidor", icon_url: s.discord.avatar || undefined }, timestamp: new Date().toISOString(), image: await gifOf("online") }] }) });
  if (!r.ok) throw new Error(`Discord respondió ${r.status}`);
  return true;
}
