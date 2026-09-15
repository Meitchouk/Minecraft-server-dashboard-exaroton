import { api } from "@/lib/exaroton";
import { handle, q, serverIdFrom } from "@/lib/route";

export const GET = handle((req) => api.fileRead(serverIdFrom(req), q(req, "path")));
export const PUT = handle(async (req) => {
  const id = serverIdFrom(req);
  const path = q(req, "path");
  if (q(req, "mkdir") === "1") return api.mkdir(id, path);
  const buf = Buffer.from(await req.arrayBuffer());
  return api.fileWrite(id, path, buf);
});
export const DELETE = handle((req) => api.fileDelete(serverIdFrom(req), q(req, "path")));
