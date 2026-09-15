import { ExarotonError, queryConsoleLines, api } from "@/lib/exaroton";
import { handle, requirePerm, serverIdFrom, userFrom } from "@/lib/route";
import { IMPROVEMENTS, byId } from "@/lib/improvements";
import { audit } from "@/lib/audit";

// GET -> estado real de cada mejora (lee gamerules y objetivos por la consola en una sola sesion)
export const GET = handle(async (req) => {
  const id = serverIdFrom(req);
  const server = await api.server(id);
  if (server.status !== 1) return { online: false, states: {} as Record<string, boolean | null> };
  const reads = [...new Set(IMPROVEMENTS.map((i) => i.read))];
  const lines = await queryConsoleLines(id, reads, 1500);
  const states: Record<string, boolean | null> = {};
  for (const i of IMPROVEMENTS) states[i.id] = i.parse(lines);
  return { online: true, states };
});

// POST { id, enabled } -> aplica los comandos de activar/desactivar
export const POST = handle(async (req) => {
  requirePerm(req, "config.write");
  const id = serverIdFrom(req);
  const { id: impId, enabled } = await req.json();
  const imp = byId(String(impId));
  if (!imp) throw new ExarotonError("Mejora desconocida", 404);
  const cmds = enabled ? imp.on : imp.off;
  const lines = await queryConsoleLines(id, [...cmds, imp.read], 1500);
  await audit({ serverId: id, kind: "action", command: `mejora ${imp.id} -> ${enabled ? "ON" : "OFF"} (${cmds.join(" ; ")})`, source: userFrom(req).username });
  return { state: imp.parse(lines), output: lines.slice(-6) };
});
