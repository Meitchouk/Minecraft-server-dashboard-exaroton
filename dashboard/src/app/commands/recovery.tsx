"use client";
import { useMemo, useState } from "react";
import { History, Trash2, Undo2, Sparkles, RotateCcw, Archive, DatabaseBackup } from "lucide-react";
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

export function RecoveryCard({ player, current, history, serverSnapshots, trash, nameOf, busy, onRestore, onDropTrash, onClearTrash }: {
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
  // Combina lecturas locales (este navegador) y copias automaticas del servidor, de mas reciente a mas antigua
  const all = useMemo(() => [
    ...history.map((h) => ({ at: h.at, items: h.items, ender: [] as InvSlot[], source: "local" as const })),
    ...serverSnapshots.map((h) => ({ at: h.at, items: h.items, ender: h.ender, source: "server" as const })),
  ].sort((a, b) => b.at - a.at), [history, serverSnapshots]);
  const snap = all[snapIdx];
  const missing = useMemo(() => (snap && current ? missingFrom(snap.items, current) : []), [snap, current]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Archive className="size-4 text-primary" />Recuperar objetos</CardTitle>
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
