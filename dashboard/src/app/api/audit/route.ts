import { auditSources, listAudit, type AuditFilter } from "@/lib/audit";
import { handle, q, serverIdFrom } from "@/lib/route";

// Historico de auditoria. Filtros: limit, from/to (ms), source (usuario), kind (command|query|action), text (subcadena).
// ?all=1 incluye tambien los eventos globales (login, administracion de usuarios), guardados bajo el servidor "-"
// ?sources=1 devuelve la lista de usuarios vistos (para el selector)
export const GET = handle(async (req) => {
  const sid = serverIdFrom(req);
  if (q(req, "sources") === "1") {
    const [a, b] = await Promise.all([auditSources(sid), auditSources("-")]);
    return [...new Set([...a, ...b])].sort();
  }
  const num = (k: string) => { const v = Number(q(req, k)); return Number.isFinite(v) && v > 0 ? v : undefined; };
  const f: AuditFilter = { limit: num("limit") ?? 200, from: num("from"), to: num("to"), source: q(req, "source") || undefined, kind: q(req, "kind") || undefined, text: q(req, "text").trim() || undefined };
  const own = await listAudit(sid, f);
  if (q(req, "all") !== "1") return own;
  const global = await listAudit("-", f);
  return [...own, ...global].sort((a, b) => b.at - a.at).slice(0, f.limit);
});
