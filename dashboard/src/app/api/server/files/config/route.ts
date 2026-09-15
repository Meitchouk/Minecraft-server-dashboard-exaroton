import { api } from "@/lib/exaroton";
import { handle, q, serverIdFrom } from "@/lib/route";

export const GET = handle((req) => api.configRead(serverIdFrom(req), q(req, "path", "server.properties")));
export const POST = handle(async (req) => {
  const options = await req.json();
  return api.configWrite(serverIdFrom(req), q(req, "path", "server.properties"), options);
});
