"use client";
import { useMemo, useState } from "react";
import { History, Trash2, Undo2, Sparkles, RotateCcw, Archive, DatabaseBackup, Maximize2, Monitor, Search } from "lucide-react";
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
  onRestore: (items: InvSlot[], trashIds?: string[]) => void;
  onDropTrash: (ids: string[]) => void;
  onClearTrash: () => void;
}) {
  const [snapIdx, setSnapIdx] = useState(0);
  const [open, setOpen] = useState(false);
  // Combina lecturas locales (este navegador) y copias automaticas del servidor, de mas reciente a mas antigua
  const all = useMemo(() => [
    ...history.map((h) => ({ at: h.at, items: h.items, ender: [] as InvSlot[], source: "local" as const })),
    ...serverSnapshots.map((h) => ({ at: h.at, items: h.items, ender: h.ender, source: "server" as const })),
  ].sort((a, b) => b.at - a.at), [history, serverSnapshots]);
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
          <FullView all={all} idx={snapIdx} setIdx={setSnapIdx} current={current} trash={trash} nameOf={nameOf} busy={busy} onRestore={onRestore} version={version} catalog={catalog} look={look} />
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
                    <Button key={`${h.source}-${h.at}`} size="xs" variant={i === snapIdx ? "default" : "outline"} onClick={() => setSnapIdx(i)} title={`${h.items.length} objetos · ${h.source === "server" ? "copia automatica" : "lectura del panel"}`}>
                      {h.source === "server" && <DatabaseBackup className="size-3" />}{i === 0 ? "Ultima" : fmt(h.at)}
                    </Button>
                  ))}
                </div>
                {snap && (
                  <>
                    <p className="text-[11px] text-muted-foreground">{fmt(snap.at)} · {snap.source === "server" ? "copia automatica" : "lectura del panel"} · {snap.items.length} objetos · {snap.items.reduce((a, i) => a + i.count, 0)} unidades{snap.ender.length > 0 && ` · cofre de Ender: ${snap.ender.length}`}</p>
                    {current && (
                      missing.length === 0 ? <p className="rounded-md bg-primary/10 px-2 py-1.5 text-xs text-primary">El inventario actual ya tiene todo lo de esta lectura.</p> : (
                        <div className="space-y-1.5 rounded-md border border-chart-3/40 bg-chart-3/10 p-2">
                          <p className="text-xs font-medium text-chart-3">Falta respecto a esta lectura ({missing.length}):</p>
                          <ul className="max-h-40 space-y-1 overflow-auto pr-1">
                            {missing.map((it, i) => <ItemRow key={i} it={it} nameOf={nameOf} disabled={busy} action={() => onRestore([it])} />)}
                          </ul>
                          <Button size="sm" className="w-full" disabled={busy} onClick={() => onRestore(missing)}><RotateCcw />Devolver todo lo que falta</Button>
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

type Snap = { at: number; items: InvSlot[]; ender: InvSlot[]; source: "local" | "server" };

// Vista a pantalla completa: linea de tiempo de copias + objetos grandes con icono y encantamientos
function FullView({ all, idx, setIdx, current, trash, nameOf, busy, onRestore, version, catalog, look }: {
  all: Snap[]; idx: number; setIdx: (i: number) => void; current: InvSlot[] | null; trash: TrashEntry[];
  nameOf: (i: InvSlot) => string; busy: boolean; onRestore: (items: InvSlot[], trashIds?: string[]) => void;
  version: string; catalog: Catalog | null; look: Lookup;
}) {
  const [tab, setTab] = useState<"missing" | "all" | "ender" | "trash">("missing");
  const [q, setQ] = useState("");
  const snap = all[idx];
  // cuantos objetos faltan respecto a cada copia (para verlo de un vistazo en la linea de tiempo)
  const missingCounts = useMemo(() => all.map((h) => (current ? missingFrom(h.items, current).length : 0)), [all, current]);
  const missing = useMemo(() => (snap && current ? missingFrom(snap.items, current) : []), [snap, current]);
  const days = useMemo(() => {
    const out: { day: string; rows: { i: number; h: Snap }[] }[] = [];
    all.forEach((h, i) => {
      const day = new Date(h.at).toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" });
      if (!out.length || out[out.length - 1].day !== day) out.push({ day, rows: [] });
      out[out.length - 1].rows.push({ i, h });
    });
    return out;
  }, [all]);
  const list = tab === "missing" ? missing : tab === "all" ? (snap?.items ?? []) : tab === "ender" ? (snap?.ender ?? []) : trash.map((t) => t.item);
  const n = q.trim().toLowerCase();
  const shown = list.map((it, k) => ({ it, k })).filter(({ it }) => !n || nameOf(it).toLowerCase().includes(n) || it.id.includes(n));

  return (
    <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[18rem_1fr]">
      {/* Linea de tiempo */}
      <div className="min-h-0 overflow-auto rounded-lg border p-2">
        {all.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">Aun no hay copias.</p>}
        {days.map((d) => (
          <div key={d.day} className="mb-2">
            <p className="sticky top-0 z-10 bg-popover px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d.day}</p>
            {d.rows.map(({ i, h }) => (
              <button key={h.source + h.at} onClick={() => { setIdx(i); setTab("missing"); }}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", i === idx && "bg-primary/15 text-primary")}>
                {h.source === "server" ? <DatabaseBackup className="size-3.5 shrink-0 opacity-70" /> : <Monitor className="size-3.5 shrink-0 opacity-70" />}
                <span className="font-mono">{new Date(h.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="text-[11px] text-muted-foreground">{h.items.length} obj.</span>
                {current && missingCounts[i] > 0 && <Badge variant="outline" className="ml-auto h-5 border-chart-3/50 px-1.5 text-[10px] text-chart-3">faltan {missingCounts[i]}</Badge>}
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
            <Badge variant="secondary">{snap.source === "server" ? "copia automatica" : "lectura del panel"}</Badge>
            <span className="text-muted-foreground">{snap.items.length} objetos · {snap.items.reduce((a, i) => a + i.count, 0)} unidades{snap.ender.length > 0 && ` · Ender: ${snap.ender.length}`}</span>
            {missing.length > 0 && <Button size="sm" className="ml-auto" disabled={busy} onClick={() => onRestore(missing)}><RotateCcw />Devolver todo lo que falta ({missing.length})</Button>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {([["missing", `Lo que falta (${missing.length})`], ["all", `Copia completa (${snap?.items.length ?? 0})`], ["ender", `Cofre de Ender (${snap?.ender.length ?? 0})`], ["trash", `Papelera (${trash.length})`]] as const).map(([k, l]) => (
            <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>{l}</Button>
          ))}
          <div className="relative ml-auto w-56"><Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar objetos…" className="h-8 pl-8 text-xs" /></div>
        </div>
        {tab === "missing" && current && missing.length === 0 && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">El inventario actual ya tiene todo lo de esta copia.</p>}
        {tab === "missing" && !current && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">Lee primero el inventario actual para calcular lo que falta.</p>}
        <div className="grid min-h-0 flex-1 auto-rows-min gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(({ it, k }) => {
            const ench = Object.entries(it.enchants);
            const trashId = tab === "trash" ? trash[k]?.id : undefined;
            return (
              <div key={(tab === "trash" ? trashId : it.slot) + ":" + k} className="flex items-start gap-3 rounded-lg border bg-card/60 p-3">
                <ItemIcon id={it.id} version={version} look={look} className="size-12 shrink-0" fallback={nameOf(it)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="line-clamp-2 font-medium leading-tight" title={it.spec}>{nameOf(it)}</span>
                    {it.count > 1 && <span className="font-mono text-sm text-muted-foreground">x{it.count}</span>}
                  </div>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{it.id} · {slotLabel(it.slot)}</p>
                  {ench.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{ench.map(([e, v]) => <Badge key={e} variant="outline" className="h-5 border-chart-5/40 px-1.5 text-[10px] text-chart-5"><Sparkles className="size-2.5" />{enchName(e, catalog, look)} {v}</Badge>)}</div>}
                </div>
                <Button size="sm" variant="outline" className="shrink-0" disabled={busy} onClick={() => onRestore([it], trashId ? [trashId] : undefined)}><Undo2 />{tab === "ender" ? "Dar" : "Devolver"}</Button>
              </div>
            );
          })}
          {shown.length === 0 && !(tab === "missing" && (missing.length === 0 || !current)) && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Nada que mostrar.</p>}
        </div>
      </div>
    </div>
  );
}
