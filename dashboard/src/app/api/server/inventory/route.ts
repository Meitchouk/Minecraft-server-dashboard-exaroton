import { ExarotonError, queryConsole } from "@/lib/exaroton";
import { checkCommands, handle, serverIdFrom, userFrom } from "@/lib/route";
import { audit } from "@/lib/audit";
import { readPlayerList } from "@/lib/player-inventory";

// POST { player, path?: "Inventory"|"EnderItems", before?: string[] } -> { slots, source }
// `before` son ordenes que se ejecutan antes de leer (quitar/dar objetos) y se auditan.
export const POST = handle(async (req) => {
  const { player, path = "Inventory", before = [] } = await req.json();
  const who = String(player ?? "").trim();
  if (!/^[A-Za-z0-9_]{2,16}$/.test(who)) throw new ExarotonError("Jugador no valido", 400);
  if (path !== "Inventory" && path !== "EnderItems") throw new ExarotonError("Ruta no valida", 400);
  const id = serverIdFrom(req);
  const cmds: string[] = (Array.isArray(before) ? before : []).map((c: unknown) => String(c ?? "").trim().replace(/^\//, "")).filter(Boolean);
  if (cmds.length) {
    checkCommands(req, cmds);
    await queryConsole(id, cmds, /$^/, 1500);
    await audit({ serverId: id, kind: "query", command: cmds.join(" ; "), source: userFrom(req).username });
  }
  const res = await readPlayerList(id, who, path);
  if (!res) throw new ExarotonError("No se pudo leer el inventario (¿esta conectado?)", 404);
  return res;
});
