import { api, ExarotonError } from "@/lib/exaroton";
import { handle, requirePerm, serverIdFrom, userFrom } from "@/lib/route";
import { audit } from "@/lib/audit";

export const POST = handle(async (req) => {
  const id = serverIdFrom(req);
  requirePerm(req, "server.power");
  const { action, useOwnCredits } = await req.json();
  await audit({ serverId: id, kind: "action", command: String(action), source: userFrom(req).username });
  switch (action) {
    case "start": return api.start(id, Boolean(useOwnCredits));
    case "stop": return api.stop(id);
    case "restart": return api.restart(id);
    default: throw new ExarotonError(`Accion invalida: ${action}`, 400);
  }
});
