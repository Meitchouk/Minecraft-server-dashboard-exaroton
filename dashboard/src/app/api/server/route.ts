import { api } from "@/lib/exaroton";
import { handle, serverIdFrom } from "@/lib/route";
export const GET = handle((req) => api.server(serverIdFrom(req)));
