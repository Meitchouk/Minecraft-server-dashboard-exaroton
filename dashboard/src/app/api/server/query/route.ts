import { ExarotonError, queryConsole } from "@/lib/exaroton";
import { handle, serverIdFrom } from "@/lib/route";

// POST { command | commands[], match, timeout? } -> { line } : ejecuta por WebSocket y devuelve la linea de respuesta
export const POST = handle(async (req) => {
  const { command, commands, match, timeout } = await req.json();
  const list: string[] = (Array.isArray(commands) ? commands : [command]).map((c: unknown) => String(c ?? "").trim().replace(/^\//, "")).filter(Boolean);
  if (!list.length) throw new ExarotonError("Comando vacio", 400);
  if (!match) throw new ExarotonError("Falta el patron `match`", 400);
  const line = await queryConsole(serverIdFrom(req), list, new RegExp(String(match)), Math.min(Number(timeout) || 8000, 20000));
  return { line };
});
