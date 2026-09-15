import { api } from "@/lib/exaroton";
import { handle, q, requirePerm, serverIdFrom } from "@/lib/route";

export const GET = handle((req) => api.fileRead(serverIdFrom(req), q(req, "path")));
export const PUT = handle(async (req) => {
  requirePerm(req, "files.write");
  const id = serverIdFrom(req);
  const path = q(req, "path");
  if (q(req, "mkdir") === "1") return api.mkdir(id, path);
  const buf = Buffer.from(await req.arrayBuffer());
  return api.fileWrite(id, path, buf);
});
export const DELETE = handle((req) => { requirePerm(req, "files.write"); return api.fileDelete(serverIdFrom(req), q(req, "path")); });
