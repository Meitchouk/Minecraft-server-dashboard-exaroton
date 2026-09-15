import { api } from "@/lib/exaroton";
import { handle, requirePerm, serverIdFrom } from "@/lib/route";
export const GET = handle((req) => api.getMotd(serverIdFrom(req)));
export const POST = handle(async (req) => {
  requirePerm(req, "server.options");
  const { motd } = await req.json();
  return api.setMotd(serverIdFrom(req), String(motd ?? ""));
});
