import "server-only";
import { overrideToken } from "@/lib/token-context";

// Cliente para la API de Exaroton. Solo se ejecuta en el servidor: el token nunca llega al navegador.
const BASE = "https://api.exaroton.com/v1";

export const STATUS: Record<number, string> = {
  0: "OFFLINE", 1: "ONLINE", 2: "STARTING", 3: "STOPPING", 4: "RESTARTING",
  5: "SAVING", 6: "LOADING", 7: "CRASHED", 8: "PENDING", 10: "PREPARING",
};

export class ExarotonError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

function token() {
  const t = overrideToken() || process.env.EXAROTON_TOKEN;
  if (!t) throw new ExarotonError("Falta EXAROTON_TOKEN (variable de entorno o .env.local)", 500);
  return t;
}

export function defaultServerId() {
  return process.env.EXAROTON_SERVER_ID ?? "";
}

type Opts = { body?: unknown; raw?: boolean; contentType?: string; text?: boolean };

async function request<T = unknown>(method: string, path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token()}` };
  let payload: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (opts.raw) {
      headers["Content-Type"] = opts.contentType ?? "application/octet-stream";
      payload = opts.body as BodyInit;
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(opts.body);
    }
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload, cache: "no-store" });
  const text = await res.text();
  let json: { success?: boolean; error?: string; data?: T } | null = null;
  try { json = JSON.parse(text); } catch { json = null; }

  if (!res.ok) throw new ExarotonError(json?.error ?? text ?? res.statusText, res.status);
  if (json && json.success === false) throw new ExarotonError(json.error ?? "Error desconocido", 400);
  if (opts.text || !json) return text as T;
  return json.data as T;
}

const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export const api = {
  account: () => request("GET", "/account/"),
  servers: () => request<ServerInfo[]>("GET", "/servers/"),
  server: (id: string) => request<ServerInfo>("GET", `/servers/${id}/`),
  logs: (id: string) => request<{ content: string }>("GET", `/servers/${id}/logs/`),
  shareLogs: (id: string) => request<{ id: string; url: string; raw: string }>("GET", `/servers/${id}/logs/share/`),

  start: (id: string, useOwnCredits = false) =>
    request("POST", `/servers/${id}/start/`, { body: { useOwnCredits } }),
  stop: (id: string) => request("GET", `/servers/${id}/stop/`),
  restart: (id: string) => request("GET", `/servers/${id}/restart/`),
  command: (id: string, command: string) => request("POST", `/servers/${id}/command/`, { body: { command } }),

  getRam: (id: string) => request<{ ram: number }>("GET", `/servers/${id}/options/ram/`),
  setRam: (id: string, ram: number) => request<{ ram: number }>("POST", `/servers/${id}/options/ram/`, { body: { ram } }),
  getMotd: (id: string) => request<{ motd: string }>("GET", `/servers/${id}/options/motd/`),
  setMotd: (id: string, motd: string) => request<{ motd: string }>("POST", `/servers/${id}/options/motd/`, { body: { motd } }),

  playerLists: (id: string) => request<string[]>("GET", `/servers/${id}/playerlists/`),
  playerList: (id: string, list: string) => request<string[]>("GET", `/servers/${id}/playerlists/${list}/`),
  playerListAdd: (id: string, list: string, entries: string[]) =>
    request<string[]>("PUT", `/servers/${id}/playerlists/${list}/`, { body: { entries } }),
  playerListRemove: (id: string, list: string, entries: string[]) =>
    request<string[]>("DELETE", `/servers/${id}/playerlists/${list}/`, { body: { entries } }),

  fileInfo: (id: string, path: string) => request<FileInfo>("GET", `/servers/${id}/files/info/${enc(path)}`),
  fileRead: (id: string, path: string) => request<string>("GET", `/servers/${id}/files/data/${enc(path)}`, { text: true }),
  fileWrite: (id: string, path: string, content: string | Buffer) =>
    request("PUT", `/servers/${id}/files/data/${enc(path)}`, { body: content, raw: true }),
  fileDelete: (id: string, path: string) => request("DELETE", `/servers/${id}/files/data/${enc(path)}`),
  mkdir: (id: string, path: string) =>
    request("PUT", `/servers/${id}/files/data/${enc(path)}`, { body: "", raw: true, contentType: "inode/directory" }),
  configRead: (id: string, path: string) => request<ConfigOption[]>("GET", `/servers/${id}/files/config/${enc(path)}`),
  configWrite: (id: string, path: string, options: Record<string, unknown>) =>
    request<ConfigOption[]>("POST", `/servers/${id}/files/config/${enc(path)}`, { body: options }),
};

export type ServerInfo = {
  id: string;
  name: string;
  address: string;
  motd: string;
  status: number;
  host: string | null;
  port: number | null;
  players: { max: number; count: number; list: string[] };
  software: { id: string; name: string; version: string } | null;
  shared: boolean;
};

export type FileInfo = {
  path: string;
  name: string;
  isTextFile: boolean;
  isConfigFile: boolean;
  isDirectory: boolean;
  isLog: boolean;
  isReadable: boolean;
  isWritable: boolean;
  size: number;
  children: FileInfo[] | null;
};

export type ConfigOption = {
  key: string;
  label: string;
  type: "string" | "integer" | "float" | "boolean" | "multiselect" | "select";
  value: unknown;
  options: string[] | null;
  min: number | null;
  max: number | null;
  step: number | null;
};

// ---- Consola en tiempo real (WebSocket) ----
// Ejecuta uno o varios comandos (en orden) a traves del stream de consola y devuelve la primera linea que cumpla `match`.
// Mucho mas rapido y fiable que /logs (que va con varios segundos de retraso).
import WebSocket from "ws";

export function queryConsole(id: string, commands: string | string[], match: RegExp, timeoutMs = 8000): Promise<string | null> {
  const list = Array.isArray(commands) ? commands : [commands];
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://api.exaroton.com/v1/servers/${id}/websocket`, { headers: { Authorization: `Bearer ${token()}` } });
    let done = false;
    const finish = (v: string | null, err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch {}
      if (err) reject(err); else resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    ws.on("error", (e) => finish(null, new ExarotonError(`WebSocket: ${e.message}`, 502)));

    // Los comandos se envian uno a uno: el siguiente sale cuando el anterior produce alguna linea de salida
    // (o tras 400 ms si no produce ninguna). Asi la consulta final siempre ve el estado ya modificado.
    let idx = 0;
    let waiting = false;
    let gap: ReturnType<typeof setTimeout> | undefined;
    const sendNext = () => {
      if (done || idx >= list.length) return;
      ws.send(JSON.stringify({ stream: "console", type: "command", data: list[idx++] }));
      if (idx < list.length) { waiting = true; gap = setTimeout(() => { waiting = false; sendNext(); }, 400); }
      else waiting = false;
    };

    ws.on("message", (raw) => {
      let msg: { type: string; stream?: string; data?: unknown };
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type === "ready") ws.send(JSON.stringify({ stream: "console", type: "start", data: { tail: 0 } }));
      else if (msg.stream === "console" && msg.type === "started") sendNext();
      else if (msg.stream === "console" && msg.type === "line") {
        const line = String(msg.data).trimEnd();
        if (waiting) { clearTimeout(gap); waiting = false; setTimeout(sendNext, 30); }
        else if (idx >= list.length && match.test(line)) finish(line);
      } else if (msg.type === "disconnected") finish(null, new ExarotonError(`Consola desconectada: ${msg.data}`, 502));
    });
  });
}
