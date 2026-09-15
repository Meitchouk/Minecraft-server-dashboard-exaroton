import { api } from "@/lib/exaroton";
import { handle, requirePerm, serverIdFrom } from "@/lib/route";
export const GET = handle((req) => api.getRam(serverIdFrom(req)));
export const POST = handle(async (req) => {
  requirePerm(req, "server.options");
  const { ram } = await req.json();
  return api.setRam(serverIdFrom(req), Number(ram));
});
