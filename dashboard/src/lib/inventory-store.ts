"use client";
import type { InvSlot } from "@/lib/snbt";
import { loadLS, saveLS } from "@/hooks/use-catalog";

// Historial de inventarios y papelera por jugador, guardados en el navegador.
// Permite devolver objetos perdidos: cada objeto guarda su `spec` (id + componentes exactos) para regenerarlo con /give.

export type Snapshot = { at: number; items: InvSlot[] };
export type TrashEntry = { id: string; at: number; reason: string; item: InvSlot };

const HIST = (p: string) => `exaroton.inv.history.${p.toLowerCase()}`;
const TRASH = (p: string) => `exaroton.inv.trash.${p.toLowerCase()}`;
const MAX_HIST = 30;
const MAX_TRASH = 200;

export const getHistory = (player: string) => loadLS<Snapshot[]>(HIST(player), []);
export const getTrash = (player: string) => loadLS<TrashEntry[]>(TRASH(player), []);

// Guarda una instantanea solo si cambio respecto a la anterior
export function pushSnapshot(player: string, items: InvSlot[]) {
  const h = getHistory(player);
  const sig = (l: InvSlot[]) => l.map((i) => `${i.slot}:${i.spec}:${i.count}`).sort().join("|");
  if (h[0] && sig(h[0].items) === sig(items)) return h;
  const next = [{ at: Date.now(), items }, ...h].slice(0, MAX_HIST);
  saveLS(HIST(player), next);
  return next;
}

export function pushTrash(player: string, items: InvSlot[], reason: string) {
  const t = getTrash(player);
  const next = [...items.map((item) => ({ id: crypto.randomUUID(), at: Date.now(), reason, item })), ...t].slice(0, MAX_TRASH);
  saveLS(TRASH(player), next);
  return next;
}

export function removeTrash(player: string, ids: string[]) {
  const next = getTrash(player).filter((e) => !ids.includes(e.id));
  saveLS(TRASH(player), next);
  return next;
}

export function clearTrash(player: string) { saveLS(TRASH(player), []); return [] as TrashEntry[]; }

// Objetos que estaban en la instantanea y ya no estan en el inventario actual (por spec, contando unidades)
export function missingFrom(snapshot: InvSlot[], current: InvSlot[]): InvSlot[] {
  const have = new Map<string, number>();
  for (const i of current) have.set(i.spec, (have.get(i.spec) ?? 0) + i.count);
  const out: InvSlot[] = [];
  for (const i of snapshot) {
    const h = have.get(i.spec) ?? 0;
    const take = Math.min(i.count, h);
    have.set(i.spec, h - take);
    const missing = i.count - take;
    if (missing > 0) out.push({ ...i, count: missing });
  }
  return out;
}

export const giveCmd = (player: string, it: InvSlot, count = it.count) => `give ${player} ${it.spec} ${count}`;
