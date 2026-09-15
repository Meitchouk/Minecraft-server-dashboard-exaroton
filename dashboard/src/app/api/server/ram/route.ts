import { api } from "@/lib/exaroton";
import { handle, serverIdFrom } from "@/lib/route";
export const GET = handle((req) => api.getRam(serverIdFrom(req)));
export const POST = handle(async (req) => {
  const { ram } = await req.json();
  return api.setRam(serverIdFrom(req), Number(ram));
});
