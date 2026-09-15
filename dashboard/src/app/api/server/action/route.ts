import { api, ExarotonError } from "@/lib/exaroton";
import { handle, serverIdFrom } from "@/lib/route";

export const POST = handle(async (req) => {
  const id = serverIdFrom(req);
  const { action, useOwnCredits } = await req.json();
  switch (action) {
    case "start": return api.start(id, Boolean(useOwnCredits));
    case "stop": return api.stop(id);
    case "restart": return api.restart(id);
    default: throw new ExarotonError(`Accion invalida: ${action}`, 400);
  }
});
