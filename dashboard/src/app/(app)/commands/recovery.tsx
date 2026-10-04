"use client";
import { useMemo, useState } from "react";
import { History, Trash2, Undo2, Sparkles, RotateCcw, Archive, DatabaseBackup, Maximize2, Monitor, Search, Layers, CheckSquare, Square } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type Catalog } from "@/hooks/use-catalog";
import { ItemIcon, enchName, slotLabel, type Lookup } from "./item-visuals";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { InvSlot } from "@/lib/snbt";
import { missingFrom, type Snapshot, type TrashEntry } from "@/lib/inventory-store";

type Snap = { at: number; items: InvSlot[]; ender: InvSlot[]; source: "local" | "server" | "combined"; seen?: Record<string, number> };

// Copia COMBINADA: une todas las copias por objeto (spec exacta, sin importar la casilla) y se queda con la mayor
// cantidad vista de cada uno. Asi se puede devolver cualquier cosa que el jugador haya tenido alguna vez.
function combine(snaps: Snap[], at: number): Snap {
  const merge = (pick: (s: Snap) => InvSlot[]) => {
    const best = new Map<string, InvSlot>();
    for (const sn of snaps) { // de mas reciente a mas antigua: la casilla guardada es la de la ultima vez que se vio
      const per = new Map<string, InvSlot>();
      for (const it of pick(sn)) { const c = per.get(it.spec); if (c) per.set(it.spec, { ...c, count: c.count + it.count }); else per.set(it.spec, { ...it }); }
      for (const [spec, it] of per) { const b = best.get(spec); if (!b) best.set(spec, it); else if (it.count > b.count) best.set(spec, { ...b, count: it.count }); }
    }
    return [...best.values()].sort((a, b) => a.id.localeCompare(b.id));
  };
  // ultima vez que se vio cada objeto (las copias llegan de mas reciente a mas antigua)
  const seen: Record<string, number> = {};
  for (const sn of snaps) for (const it of [...sn.items, ...sn.ender]) if (!(it.spec in seen)) seen[it.spec] = sn.at;
  return { at, items: merge((x) => x.items), ender: merge((x) => x.ender), source: "combined", seen };
}

const fmt = (t: number) => new Date(t).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function ItemRow({ it, nameOf, action, actionLabel, disabled, extra }: { it: InvSlot; nameOf: (i: InvSlot) => string; action?: () => void; actionLabel?: string; disabled?: boolean; extra?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
      <span className="min-w-0 flex-1 truncate" title={it.spec}>
        {nameOf(it)} <span className="text-muted-foreground">x{it.count}</span>
        {Object.keys(it.enchants).length > 0 && <Sparkles className="ml-1 inline size-3 text-chart-5" />}
        {it.id.includes(":") && <Badge variant="outline" className="ml-1 h-4 border-chart-3/50 px-1 text-[9px] text-chart-3">mod</Badge>}
      </span>
      {extra}
      {action && <Button size="xs" variant="outline" onClick={action} disabled={disabled}><Undo2 />{actionLabel ?? "Devolver"}</Button>}
    </li>
  );
}

export function RecoveryCard({ version, catalog, look, player, current, history, serverSnapshots, trash, nameOf, busy, onRestore, onDropTrash, onClearTrash }: {
  version: string;
  catalog: Catalog | null;
  look: Lookup;
  player: string;
  current: InvSlot[] | null;
  history: Snapshot[];
  serverSnapshots: { at: number; items: InvSlot[]; ender: InvSlot[] }[];
  trash: TrashEntry[];
  nameOf: (i: InvSlot) => string;
  busy: boolean;
  onRestore: (items: InvSlot[], trashIds?: string[], snapshot?: InvSlot[]) => void;
  onDropTrash: (ids: string[]) => void;
  onClearTrash: () => void;
}) {
  const [snapIdx, setSnapIdx] = useState(0);
  const [open, setOpen] = useState(false);
  // Combina lecturas locales (este navegador) y copias automaticas del servidor, de mas reciente a mas antigua
  // Agrupar: cada ventana de N minutos se une en una sola copia combinada (0 = ver cada copia por separado)
  const [win, setWin] = useState(0);
  const all = useMemo<Snap[]>(() => {
    const snaps: Snap[] = [
      ...history.map((h) => ({ at: h.at, items: h.items, ender: [] as InvSlot[], source: "local" as const })),
      ...serverSnapshots.map((h) => ({ at: h.at, items: h.items, ender: h.ender, source: "server" as const })),
    ].sort((a, b) => b.at - a.at);
    if (!win) return snaps;
    const buckets = new Map<number, Snap[]>();
    for (const sn of snaps) { const b = Math.floor(sn.at / (win * 60000)); buckets.set(b, [...(buckets.get(b) ?? []), sn]); }
    return [...buckets.values()].map((g) => combine(g, g[0].at));
  }, [history, serverSnapshots, win]);
  const snap = all[snapIdx];
  const missing = useMemo(() => (snap && current ? missingFrom(snap.items, current) : []), [snap, current]);

  return (
    <Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[92vh] w-[96vw] max-w-[96vw] flex-col sm:max-w-[96vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Archive className="size-4 text-primary" />Recuperar objetos de {player || "—"}</DialogTitle>
            <DialogDescription>Elige una copia a la izquierda: arriba ves lo que le falta ahora respecto a esa copia, y puedes devolver objeto a objeto o todo junto. Todo se regenera con sus encantamientos y componentes exactos.</DialogDescription>
          </DialogHeader>
          <FullView all={all} idx={snapIdx} setIdx={setSnapIdx} win={win} setWin={(w) => { setWin(w); setSnapIdx(0); }} current={current} trash={trash} nameOf={nameOf} busy={busy} onRestore={onRestore} version={version} catalog={catalog} look={look} />
        </DialogContent>
      </Dialog>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Archive className="size-4 text-primary" />Recuperar objetos
          <Button size="xs" variant="outline" className="ml-auto" onClick={() => setOpen(true)} disabled={!player}><Maximize2 />Vista completa</Button>
        </CardTitle>
        <CardDescription>Lo que se quita desde aqui va a la papelera; ademas cada lectura guarda una copia del inventario. Todo se regenera con sus encantamientos y componentes exactos.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="trash">
          <TabsList className="w-full">
            <TabsTrigger value="trash" className="flex-1 gap-1.5"><Trash2 className="size-3.5" />Papelera {trash.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{trash.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 gap-1.5"><History className="size-3.5" />Historial {all.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{all.length}</Badge>}</TabsTrigger>
          </TabsList>

          <TabsContent value="trash" className="space-y-2">
            {trash.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">Papelera vacia para {player || "este jugador"}.</p> : (
              <>
                <ul className="max-h-64 space-y-1 overflow-auto pr-1">
                  {trash.map((e) => (
                    <ItemRow key={e.id} it={e.item} nameOf={nameOf} disabled={busy} action={() => onRestore([e.item], [e.id])}
                      extra={<span className="shrink-0 text-[10px] text-muted-foreground" title={e.reason}>{fmt(e.at)}</span>} />
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" disabled={busy} onClick={() => onRestore(trash.map((e) => e.item), trash.map((e) => e.id))}><Undo2 />Devolver todo ({trash.length})</Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button size="sm" variant="ghost" />}><Trash2 />Vaciar papelera</AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Vaciar la papelera?</AlertDialogTitle><AlertDialogDescription>Ya no podras devolver estos {trash.length} objetos desde aqui (aunque seguiran en el historial si estaban en alguna lectura).</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onClearTrash}>Vaciar</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {trash.length > 0 && <Button size="xs" variant="ghost" className="w-full" onClick={() => onDropTrash(trash.map((e) => e.id))}>Descartar sin devolver</Button>}
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-2">
            {all.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">Aun no hay lecturas ni copias guardadas.</p> : (
              <>
                <div className="flex max-h-24 flex-wrap gap-1 overflow-auto">
                  {all.slice(0, 40).map((h, i) => (
                    <Button key={`${h.source}-${h.at}`} size="xs" variant={i === snapIdx ? "default" : "outline"} onClick={() => setSnapIdx(i)} title={`${h.items.length} objetos · ${h.source === "combined" ? "union de todas las copias de esa franja" : h.source === "server" ? "copia automatica" : "lectura del panel"}`}>
                      {h.source === "combined" ? <Layers className="size-3" /> : h.source === "server" && <DatabaseBackup className="size-3" />}{h.source === "combined" ? fmt(h.at) : i === 0 ? "Ultima" : fmt(h.at)}
                    </Button>
                  ))}
                </div>
                {snap && (
                  <>
                    <p className="text-[11px] text-muted-foreground">{fmt(snap.at)} · {snap.source === "combined" ? "combinada de la franja" : snap.source === "server" ? "copia automatica" : "lectura del panel"} · {snap.items.length} objetos · {snap.items.reduce((a, i) => a + i.count, 0)} unidades{snap.ender.length > 0 && ` · cofre de Ender: ${snap.ender.length}`}</p>
                    {current && (
                      missing.length === 0 ? <p className="rounded-md bg-primary/10 px-2 py-1.5 text-xs text-primary">El inventario actual ya tiene todo lo de esta lectura.</p> : (
                        <div className="space-y-1.5 rounded-md border border-chart-3/40 bg-chart-3/10 p-2">
                          <p className="text-xs font-medium text-chart-3">Falta respecto a esta lectura ({missing.length}):</p>
                          <ul className="max-h-40 space-y-1 overflow-auto pr-1">
                            {missing.map((it, i) => <ItemRow key={i} it={it} nameOf={nameOf} disabled={busy} action={() => onRestore([it], undefined, snap.items)} />)}
                          </ul>
                          <Button size="sm" className="w-full" disabled={busy} onClick={() => onRestore(missing, undefined, snap.items)}><RotateCcw />Devolver todo lo que falta</Button>
                        </div>
                      )
                    )}
                    {snap.ender.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">Cofre de Ender en esta copia ({snap.ender.length})</summary>
                        <ul className="mt-1 max-h-40 space-y-1 overflow-auto pr-1">
                          {snap.ender.map((it) => <ItemRow key={it.slot} it={it} nameOf={nameOf} disabled={busy} action={() => onRestore([it])} actionLabel="Dar al inventario" />)}
                        </ul>
                      </details>
                    )}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Ver los {snap.items.length} objetos de la lectura</summary>
                      <ul className="mt-1 max-h-48 space-y-1 overflow-auto pr-1">
                        {snap.items.map((it) => <ItemRow key={it.slot} it={it} nameOf={nameOf} disabled={busy} action={() => onRestore([it])} extra={<span className="shrink-0 font-mono text-[10px] text-muted-foreground">slot {it.slot}</span>} />)}
                      </ul>
                    </details>
                  </>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}


// Vista a pantalla completa: linea de tiempo de copias + objetos grandes con icono y encantamientos
function FullView({ all, idx, setIdx, win, setWin, current, trash, nameOf, busy, onRestore, version, catalog, look }: {
  all: Snap[]; idx: number; setIdx: (i: number) => void; win: number; setWin: (w: number) => void; current: InvSlot[] | null; trash: TrashEntry[];
  nameOf: (i: InvSlot) => string; busy: boolean; onRestore: (items: InvSlot[], trashIds?: string[], snapshot?: InvSlot[]) => void;
  version: string; catalog: Catalog | null; look: Lookup;
}) {
  const [tab, setTab] = useState<"missing" | "armor" | "all" | "ender" | "trash">("missing");
  // la seleccion es valida solo para la pestaña y copia donde se hizo
  const ctx = `${tab}:${all[idx]?.at ?? 0}`;
  const [selState, setSelState] = useState<{ ctx: string; set: Set<number> }>({ ctx: "", set: new Set() });
  const sel = selState.ctx === ctx ? selState.set : new Set<number>();
  const setSel = (f: Set<number> | ((s: Set<number>) => Set<number>)) => setSelState({ ctx, set: typeof f === "function" ? f(sel) : f });
  const isArmor = (i: InvSlot) => i.slot >= 100 || i.slot < 0;
  const [q, setQ] = useState("");
  const [against, setAgainst] = useState(-1); // -1 = inventario actual; si no, otra copia con la que comparar
  const snap = all[idx];
  const baseItems = against >= 0 && all[against] ? all[against].items : current;
  // perdida entre cada copia y la anterior en el tiempo: objetos que estaban en la anterior y ya no (muertes, errores...)
  const losses = useMemo(() => all.map((h, i) => (all[i + 1] && h.source !== "combined" ? missingFrom(all[i + 1].items, h.items).length : 0)), [all]);
  // cuantos objetos faltan respecto a cada copia (para verlo de un vistazo en la linea de tiempo)
  const missingCounts = useMemo(() => all.map((h) => (current ? missingFrom(h.items, current).length : 0)), [all, current]);
  const missing = useMemo(() => (snap && baseItems ? missingFrom(snap.items, baseItems) : []), [snap, baseItems]);
  const days = useMemo(() => {
    const out: { day: string; rows: { i: number; h: Snap }[] }[] = [];
    all.forEach((h, i) => {
      const day = new Date(h.at).toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" });
      if (!out.length || out[out.length - 1].day !== day) out.push({ day, rows: [] });
      out[out.length - 1].rows.push({ i, h });
    });
    return out;
  }, [all]);
  const list = tab === "missing" ? missing : tab === "armor" ? (snap?.items ?? []).filter(isArmor) : tab === "all" ? (snap?.items ?? []) : tab === "ender" ? (snap?.ender ?? []) : trash.map((t) => t.item);
  const n = q.trim().toLowerCase();
  const shown = list.map((it, k) => ({ it, k })).filter(({ it }) => !n || nameOf(it).toLowerCase().includes(n) || it.id.includes(n));
  const dedupe = tab === "missing" || tab === "armor" ? snap?.items : undefined; // recalcula contra el inventario real al devolver
  const picked = shown.filter(({ k }) => sel.has(k));
  const allPicked = shown.length > 0 && picked.length === shown.length;
  const toggle = (k: number) => setSel((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  const restorePicked = () => onRestore(picked.map(({ it }) => it), tab === "trash" ? picked.map(({ k }) => trash[k]?.id).filter(Boolean) : undefined, dedupe);

  return (
    <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[18rem_1fr]">
      {/* Linea de tiempo */}
      <div className="min-h-0 overflow-auto rounded-lg border p-2">
        <div className="mb-2 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <Layers className="size-3.5" />Combinar cada
          <select value={win} onChange={(e) => setWin(Number(e.target.value))} className="ml-auto h-7 rounded-md border bg-background px-1.5 text-xs text-foreground">
            {[[0, "Sin combinar"], [15, "15 min"], [30, "30 min"], [60, "1 hora"], [360, "6 horas"], [1440, "1 dia"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {all.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">Aun no hay copias.</p>}
        {days.map((d) => (
          <div key={d.day} className="mb-2">
            <p className="sticky top-0 z-10 bg-popover px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d.day}</p>
            {d.rows.map(({ i, h }) => (
              <button key={h.source + h.at} onClick={() => { setIdx(i); setTab("missing"); }}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", i === idx && "bg-primary/15 text-primary")}>
                {h.source === "combined" ? <Layers className="size-3.5 shrink-0 text-primary" /> : h.source === "server" ? <DatabaseBackup className="size-3.5 shrink-0 opacity-70" /> : <Monitor className="size-3.5 shrink-0 opacity-70" />}
                <span className={h.source === "combined" ? "font-medium" : "font-mono"}>{new Date(h.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{h.source === "combined" && win > 0 && <span className="text-[11px] text-muted-foreground"> · ult. {win < 60 ? `${win} min` : win < 1440 ? `${win / 60} h` : "dia"}</span>}</span>
                <span className="text-[11px] text-muted-foreground">{h.items.length} obj.</span>
                {losses[i] >= 5 && <Badge variant="outline" className="h-5 border-destructive/50 px-1.5 text-[10px] text-destructive" title={`Respecto a la copia anterior se perdieron ${losses[i]} objetos`}>-{losses[i]}</Badge>}
                {current && missingCounts[i] > 0 && <Badge variant="outline" className={cn("h-5 border-chart-3/50 px-1.5 text-[10px] text-chart-3", losses[i] < 5 && "ml-auto")}>faltan {missingCounts[i]}</Badge>}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Detalle */}
      <div className="flex min-h-0 flex-col gap-3">
        {snap && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="font-medium">{fmt(snap.at)}</span>
            <Badge variant="secondary">{snap.source === "combined" ? "combinada de la franja" : snap.source === "server" ? "copia automatica" : "lectura del panel"}</Badge>
            <span className="text-muted-foreground">{snap.items.length} objetos · {snap.items.reduce((a, i) => a + i.count, 0)} unidades{snap.ender.length > 0 && ` · Ender: ${snap.ender.length}`}</span>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">Comparar con
              <select value={against} onChange={(e) => setAgainst(Number(e.target.value))} className="h-7 max-w-44 rounded-md border bg-background px-1.5 text-xs text-foreground">
                <option value={-1}>Inventario actual</option>
                {all.map((h, i) => i !== idx && <option key={h.source + h.at} value={i}>{fmt(h.at)}{h.source === "combined" ? " (combinada)" : ""}</option>)}
              </select>
            </label>
            {losses[idx] >= 5 && all[idx + 1] && <Button size="sm" variant="outline" onClick={() => { setIdx(idx + 1); setTab("missing"); }}>Perdio {losses[idx]} objetos: ver la copia anterior</Button>}
            {missing.length > 0 && <Button size="sm" disabled={busy} onClick={() => onRestore(missing, undefined, snap.items)}><RotateCcw />Devolver todo lo que falta ({missing.length})</Button>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {([["missing", `${against >= 0 ? "Diferencias" : "Lo que falta"} (${missing.length})`], ["armor", `Armadura (${(snap?.items ?? []).filter(isArmor).length})`], ["all", `Copia completa (${snap?.items.length ?? 0})`], ["ender", `Cofre de Ender (${snap?.ender.length ?? 0})`], ["trash", `Papelera (${trash.length})`]] as const).map(([k, l]) => (
            <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>{l}</Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={!shown.length} onClick={() => setSel(allPicked ? new Set() : new Set(shown.map(({ k }) => k)))}>{allPicked ? <Square /> : <CheckSquare />}{allPicked ? "Quitar seleccion" : "Seleccionar todo"}</Button>
            <Button size="sm" disabled={busy || !picked.length} onClick={restorePicked}><Undo2 />{tab === "ender" ? "Dar" : "Devolver"} seleccionados ({picked.length})</Button>
          </div>
          <div className="relative w-56"><Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar objetos…" className="h-8 pl-8 text-xs" /></div>
        </div>
        {tab === "missing" && baseItems && missing.length === 0 && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{against >= 0 ? "La otra copia ya tiene todo lo de esta." : "El inventario actual ya tiene todo lo de esta copia."}</p>}
        {tab === "missing" && against < 0 && !current && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">Lee primero el inventario actual para calcular lo que falta.</p>}
        <div className="grid min-h-0 flex-1 auto-rows-min gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(({ it, k }) => {
            const ench = Object.entries(it.enchants);
            const trashId = tab === "trash" ? trash[k]?.id : undefined;
            return (
              <div key={(tab === "trash" ? trashId : it.slot) + ":" + k} onClick={() => toggle(k)} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border bg-card/60 p-3 transition-colors hover:border-primary/40", sel.has(k) && "border-primary bg-primary/10")}>
                {sel.has(k) ? <CheckSquare className="mt-1 size-4 shrink-0 text-primary" /> : <Square className="mt-1 size-4 shrink-0 text-muted-foreground" />}
                <ItemIcon id={it.id} version={version} look={look} className="size-12 shrink-0" fallback={nameOf(it)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="line-clamp-2 font-medium leading-tight" title={it.spec}>{nameOf(it)}</span>
                    {it.count > 1 && <span className="font-mono text-sm text-muted-foreground">x{it.count}</span>}
                  </div>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{it.id} · {slotLabel(it.slot)}{snap?.seen?.[it.spec] ? ` · visto ${fmt(snap.seen[it.spec])}` : ""}</p>
                  {ench.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{ench.map(([e, v]) => <Badge key={e} variant="outline" className="h-5 border-chart-5/40 px-1.5 text-[10px] text-chart-5"><Sparkles className="size-2.5" />{enchName(e, catalog, look)} {v}</Badge>)}</div>}
                </div>
                <Button size="sm" variant="outline" className="shrink-0" disabled={busy} onClick={(e) => { e.stopPropagation(); onRestore([it], trashId ? [trashId] : undefined, dedupe); }}><Undo2 />{tab === "ender" ? "Dar" : "Devolver"}</Button>
              </div>
            );
          })}
          {shown.length === 0 && !(tab === "missing" && (missing.length === 0 || !baseItems)) && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Nada que mostrar.</p>}
        </div>
      </div>
    </div>
  );
}
