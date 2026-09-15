import { listAudit } from "@/lib/audit";
import { handle, q, serverIdFrom } from "@/lib/route";

// ?all=1 incluye tambien los eventos globales (login, administracion de usuarios), guardados bajo el servidor "-"
export const GET = handle(async (req) => {
  const limit = Number(q(req, "limit", "200")) || 200;
  const own = await listAudit(serverIdFrom(req), limit);
  if (q(req, "all") !== "1") return own;
  const global = await listAudit("-", limit);
  return [...own, ...global].sort((a, b) => b.at - a.at).slice(0, limit);
});
