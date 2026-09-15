// Cliente minimo para la API de Exaroton (https://developers.exaroton.com/)
const BASE = "https://api.exaroton.com/v1";

const STATUS = {
  0: "OFFLINE", 1: "ONLINE", 2: "STARTING", 3: "STOPPING", 4: "RESTARTING",
  5: "SAVING", 6: "LOADING", 7: "CRASHED", 8: "PENDING", 10: "PREPARING",
};

export function statusName(code) {
  return STATUS[code] ?? `UNKNOWN(${code})`;
}

function token() {
  const t = process.env.EXAROTON_TOKEN;
  if (!t) throw new Error("Falta EXAROTON_TOKEN en .env");
  return t;
}

export function serverId(override) {
  const id = override || process.env.EXAROTON_SERVER_ID;
  if (!id) throw new Error("Falta EXAROTON_SERVER_ID en .env (usa `npm run servers` para verlo)");
  return id;
}

async function request(method, path, { body, raw = false, contentType } = {}) {
  const headers = { Authorization: `Bearer ${token()}` };
  let payload;
  if (body !== undefined) {
    if (raw) {
      headers["Content-Type"] = contentType ?? "text/plain";
      payload = body;
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }

  if (!res.ok) {
    const msg = json?.error ?? text ?? res.statusText;
    throw new Error(`HTTP ${res.status} ${method} ${path}: ${msg}`);
  }
  if (json && json.success === false) throw new Error(json.error ?? "Error desconocido");
  return json ? json.data : text;
}

// ---- Cuenta / servidores ----
export const account = () => request("GET", "/account/");
export const servers = () => request("GET", "/servers/");
export const server = (id) => request("GET", `/servers/${serverId(id)}/`);
export const logs = (id) => request("GET", `/servers/${serverId(id)}/logs/`);
export const shareLogs = (id) => request("GET", `/servers/${serverId(id)}/logs/share/`);

// ---- Control ----
export const start = (id) => request("GET", `/servers/${serverId(id)}/start/`);
export const stop = (id) => request("GET", `/servers/${serverId(id)}/stop/`);
export const restart = (id) => request("GET", `/servers/${serverId(id)}/restart/`);
export const command = (cmd, id) => request("POST", `/servers/${serverId(id)}/command/`, { body: { command: cmd } });

// ---- Opciones ----
export const getRam = (id) => request("GET", `/servers/${serverId(id)}/options/ram/`);
export const setRam = (gb, id) => request("POST", `/servers/${serverId(id)}/options/ram/`, { body: { ram: Number(gb) } });
export const getMotd = (id) => request("GET", `/servers/${serverId(id)}/options/motd/`);
export const setMotd = (motd, id) => request("POST", `/servers/${serverId(id)}/options/motd/`, { body: { motd } });

// ---- Listas de jugadores: whitelist | ops | banned-players | banned-ips ----
export const playerLists = (id) => request("GET", `/servers/${serverId(id)}/playerlists/`);
export const playerList = (list, id) => request("GET", `/servers/${serverId(id)}/playerlists/${list}/`);
export const playerListAdd = (list, names, id) =>
  request("PUT", `/servers/${serverId(id)}/playerlists/${list}/`, { body: { entries: names } });
export const playerListRemove = (list, names, id) =>
  request("DELETE", `/servers/${serverId(id)}/playerlists/${list}/`, { body: { entries: names } });

// ---- Archivos ----
export const fileInfo = (path, id) => request("GET", `/servers/${serverId(id)}/files/info/${path}`);
export const fileRead = (path, id) => request("GET", `/servers/${serverId(id)}/files/data/${path}`);
export const fileWrite = (path, content, id) =>
  request("PUT", `/servers/${serverId(id)}/files/data/${path}`, { body: content, raw: true, contentType: "application/octet-stream" });
export const fileDelete = (path, id) => request("DELETE", `/servers/${serverId(id)}/files/data/${path}`);
// Archivos de configuracion con formato conocido (ej. server.properties) -> JSON de opciones
export const configRead = (path, id) => request("GET", `/servers/${serverId(id)}/files/config/${path}`);
export const configWrite = (path, options, id) => request("POST", `/servers/${serverId(id)}/files/config/${path}`, { body: options });
