"use client";

// Helpers de red para el navegador. El token nunca esta aqui: todo pasa por /api/*.
const KEY = "exaroton.serverId";

export function getServerId(): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}

export function setServerId(id: string) {
  try { localStorage.setItem(KEY, id); } catch {}
  window.dispatchEvent(new Event("exaroton:server-changed"));
}

// API key propia del usuario: solo en sessionStorage (se borra al cerrar la pestaña); nunca se envia a ningun sitio salvo a nuestro /api
const OWN_KEY = "exaroton.ownToken";
export function getOwnToken(): string { try { return sessionStorage.getItem(OWN_KEY) ?? ""; } catch { return ""; } }
export function setOwnToken(t: string) {
  try { if (t) sessionStorage.setItem(OWN_KEY, t); else sessionStorage.removeItem(OWN_KEY); } catch {}
  try { localStorage.removeItem(KEY); } catch {} // el servidor por defecto puede no existir con otra key
  window.dispatchEvent(new Event("exaroton:server-changed"));
}

export class ApiError extends Error {}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const sid = getServerId();
  if (sid) headers.set("x-server-id", sid);
  const own = getOwnToken();
  if (own) headers.set("x-exaroton-token", own);
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...init, headers, cache: "no-store" });
  const json = await res.json().catch(() => ({ ok: false, error: res.statusText }));
  if (!res.ok || !json.ok) throw new ApiError(json.error ?? "Error de red");
  return json.data as T;
}

export const STATUS_LABEL: Record<number, string> = {
  0: "Apagado", 1: "En linea", 2: "Iniciando", 3: "Deteniendo", 4: "Reiniciando",
  5: "Guardando", 6: "Cargando", 7: "Crasheado", 8: "Pendiente", 10: "Preparando",
};

export const STATUS_TONE: Record<number, "ok" | "warn" | "bad" | "off"> = {
  0: "off", 1: "ok", 2: "warn", 3: "warn", 4: "warn", 5: "warn", 6: "warn", 7: "bad", 8: "warn", 10: "warn",
};

export type ServerInfo = {
  id: string; name: string; address: string; motd: string; status: number;
  host: string | null; port: number | null;
  players: { max: number; count: number; list: string[] };
  software: { id: string; name: string; version: string } | null;
  shared: boolean;
};

export type FileInfo = {
  path: string; name: string; isTextFile: boolean; isConfigFile: boolean; isDirectory: boolean;
  isLog: boolean; isReadable: boolean; isWritable: boolean; size: number; children: FileInfo[] | null;
};

export type ConfigOption = {
  key: string; label: string;
  type: "string" | "integer" | "float" | "boolean" | "multiselect" | "select";
  value: unknown; options: string[] | null; min: number | null; max: number | null; step: number | null;
};

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

// Convierte codigos § de Minecraft a spans con color
const MC_COLORS: Record<string, string> = {
  "0": "#000", "1": "#00A", "2": "#0A0", "3": "#0AA", "4": "#A00", "5": "#A0A", "6": "#FA0", "7": "#AAA",
  "8": "#555", "9": "#55F", a: "#5F5", b: "#5FF", c: "#F55", d: "#F5F", e: "#FF5", f: "#FFF",
};
export function motdToSpans(motd: string): { text: string; color?: string; bold?: boolean; italic?: boolean }[] {
  const out: { text: string; color?: string; bold?: boolean; italic?: boolean }[] = [];
  let color: string | undefined, bold = false, italic = false, buf = "";
  const flush = () => { if (buf) out.push({ text: buf, color, bold, italic }); buf = ""; };
  for (let i = 0; i < motd.length; i++) {
    if (motd[i] === "§" && i + 1 < motd.length) {
      const c = motd[++i].toLowerCase();
      flush();
      if (MC_COLORS[c]) { color = MC_COLORS[c]; bold = italic = false; }
      else if (c === "l") bold = true;
      else if (c === "o") italic = true;
      else if (c === "r") { color = undefined; bold = italic = false; }
    } else if (motd[i] === "\n") { flush(); out.push({ text: "\n" }); }
    else buf += motd[i];
  }
  flush();
  return out;
}
