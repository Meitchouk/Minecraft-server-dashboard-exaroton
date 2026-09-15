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

export async function listAudit(serverId: string, limit = 200): Promise<AuditEntry[]> {
  const d = db();
  if (d) {
    const q = await d.collection("servers").doc(serverId).collection("audit").orderBy("at", "desc").limit(limit).get();
    return q.docs.map((x) => x.data() as AuditEntry);
  }
  try {
    const lines = (await fs.readFile(FILE, "utf8")).split("\n").filter(Boolean);
    return lines.map((l) => JSON.parse(l) as AuditEntry).filter((x) => x.serverId === serverId).slice(-limit).reverse();
  } catch { return []; }
}
