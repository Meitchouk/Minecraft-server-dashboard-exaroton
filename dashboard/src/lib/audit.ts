import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/firebase";

// Registro de auditoria: cada comando ejecutado desde el panel (para investigar perdidas, abusos, etc.)
export type AuditEntry = { at: number; serverId: string; kind: "command" | "query" | "action"; command: string; result?: string; source?: string };

const FILE = path.join(process.cwd(), "data", "audit.jsonl");

export async function audit(e: Omit<AuditEntry, "at">) {
  const entry: AuditEntry = { at: Date.now(), ...e };
  try {
    const d = db();
    if (d) await d.collection("servers").doc(e.serverId).collection("audit").add(entry);
    else { await fs.mkdir(path.dirname(FILE), { recursive: true }); await fs.appendFile(FILE, JSON.stringify(entry) + "\n"); }
  } catch { /* la auditoria nunca debe romper la accion */ }
}

// Filtros del historico. El rango de fechas se aplica en Firestore; usuario/tipo/texto en memoria
// (evita indices compuestos y permite busqueda por subcadena). Se leen hasta 'scan' documentos del rango.
export type AuditFilter = { limit?: number; from?: number; to?: number; source?: string; kind?: string; text?: string };

export async function listAudit(serverId: string, limitOrFilter: number | AuditFilter = 200): Promise<AuditEntry[]> {
  const f: AuditFilter = typeof limitOrFilter === "number" ? { limit: limitOrFilter } : limitOrFilter;
  const limit = Math.min(Math.max(f.limit ?? 200, 1), 5000);
  const filtered = f.source || f.kind || f.text;
  const scan = filtered ? Math.max(limit * 10, 2000) : limit;
  let rows: AuditEntry[];
  const d = db();
  if (d) {
    let q = d.collection("servers").doc(serverId).collection("audit").orderBy("at", "desc");
    if (f.from) q = q.where("at", ">=", f.from);
    if (f.to) q = q.where("at", "<=", f.to);
    rows = (await q.limit(scan).get()).docs.map((x) => x.data() as AuditEntry);
  } else {
    try {
      const lines = (await fs.readFile(FILE, "utf8")).split("\n").filter(Boolean);
      rows = lines.map((l) => JSON.parse(l) as AuditEntry).filter((x) => x.serverId === serverId && (!f.from || x.at >= f.from) && (!f.to || x.at <= f.to)).reverse();
    } catch { rows = []; }
  }
  const text = f.text?.toLowerCase();
  if (f.source) rows = rows.filter((x) => (x.source ?? "?") === f.source);
  if (f.kind) rows = rows.filter((x) => x.kind === f.kind);
  if (text) rows = rows.filter((x) => x.command.toLowerCase().includes(text) || (x.result ?? "").toLowerCase().includes(text));
  return rows.slice(0, limit);
}

// Usuarios distintos vistos en la auditoria (para el selector de filtros)
export async function auditSources(serverId: string): Promise<string[]> {
  const rows = await listAudit(serverId, 2000);
  return [...new Set(rows.map((x) => x.source ?? "?"))].sort();
}
