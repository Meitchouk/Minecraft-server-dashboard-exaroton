import { listAudit } from "@/lib/audit";
import { handle, q, serverIdFrom } from "@/lib/route";
export const GET = handle((req) => listAudit(serverIdFrom(req), Number(q(req, "limit", "200")) || 200));
