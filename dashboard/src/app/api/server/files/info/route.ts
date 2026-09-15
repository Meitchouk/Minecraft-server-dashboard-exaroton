import { api } from "@/lib/exaroton";
import { handle, q, serverIdFrom } from "@/lib/route";
export const GET = handle((req) => api.fileInfo(serverIdFrom(req), q(req, "path", "/")));
