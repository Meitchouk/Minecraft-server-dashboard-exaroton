import { api } from "@/lib/exaroton";
import { handle, serverIdFrom } from "@/lib/route";
export const GET = handle((req) => api.getMotd(serverIdFrom(req)));
export const POST = handle(async (req) => {
  const { motd } = await req.json();
  return api.setMotd(serverIdFrom(req), String(motd ?? ""));
});
