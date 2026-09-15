import { ExarotonError, queryConsole } from "@/lib/exaroton";
import { handle, serverIdFrom, userFrom } from "@/lib/route";
import { audit } from "@/lib/audit";

// POST { command | commands[], match, timeout? } -> { line } : ejecuta por WebSocket y devuelve la linea de respuesta
export const POST = handle(async (req) => {
  const { command, commands, match, timeout } = await req.json();
  const list: string[] = (Array.isArray(commands) ? commands : [command]).map((c: unknown) => String(c ?? "").trim().replace(/^\//, "")).filter(Boolean);
  if (!list.length) throw new ExarotonError("Comando vacio", 400);
  if (!match) throw new ExarotonError("Falta el patron `match`", 400);
  const id = serverIdFrom(req);
  const line = await queryConsole(id, list, new RegExp(String(match)), Math.min(Number(timeout) || 8000, 20000));
  // solo se auditan las ordenes que modifican algo (no las lecturas data get)
  const mutating = list.filter((c) => !/^data get /.test(c));
  if (mutating.length) await audit({ serverId: id, kind: "query", command: mutating.join(" ; "), source: userFrom(req).username });
  return { line };
});
