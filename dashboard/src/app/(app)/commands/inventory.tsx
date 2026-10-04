"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Backpack, RefreshCw, Trash2, Plus, Search, Loader2, Shield, Hand, Sparkles, Eraser, CheckSquare, Square, Copy, Timer, LayoutGrid, List, Maximize2, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TargetPicker } from "@/components/target-picker";
import { useCommands } from "@/components/command-runner";
import { label, type Catalog, type CatalogItem } from "@/hooks/use-catalog";
import { apiFetch } from "@/lib/client";
import { type InvSlot } from "@/lib/snbt";
import { buildGive, recommendedFor } from "./give";
import { RecoveryCard } from "./recovery";
import { BackupsCard } from "./backups";
import { giveCmd, missingFrom, pushSnapshot, type Snapshot, type TrashEntry } from "@/lib/inventory-store";
import { useStore } from "@/hooks/use-store";
import { useModCatalog } from "@/hooks/use-mod-catalog";
import { ItemIcon, enchName, lookupFor, slotLabel, type Lookup } from "./item-visuals";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Slots del inventario vanilla: 0-8 hotbar, 9-35 principal, 100-103 armadura (pies..cabeza), -106 mano secundaria
const ARMOR: { slot: number; label: string }[] = [
  { slot: 103, label: "Casco" },
  { slot: 102, label: "Pechera" },
  { slot: 101, label: "Pantalones" },
  { slot: 100, label: "Botas" },
];

// Lee el inventario real por el WebSocket de consola: ejecuta `data get` y espera la linea de respuesta (~1-2 s)
async function readInventory(player: string, before: string[] = []): Promise<InvSlot[] | null> {
  try {
    const r = await apiFetch<{ slots: InvSlot[]; source: "console" | "file" }>("/api/server/inventory", { method: "POST", body: JSON.stringify({ player, before }) });
    if (r.source === "file") toast.info("Inventario leido del archivo del jugador", { description: "Tenia objetos con muchos datos y la consola los recortaba." });
    return r.slots;
  } catch (e) { toast.error("No se pudo leer el inventario", { description: (e as Error).message }); return null; }
}

export function InventoryCommand({ catalog, players }: { catalog: Catalog | null; players: string[] }) {
  const { online, running } = useCommands();
  const [player, setPlayer] = useState(players[0] ?? "");
  const [inv, setInv] = useState<InvSlot[] | null>(null);
  const [loadedFor, setLoadedFor] = useState("");
  const [reading, setReading] = useState(false);
  const [sel, setSel] = useState<Set<number>>(() => new Set());
  const [auto, setAuto] = useState(false);
  const [q, setQ] = useState("");
  const [addItem, setAddItem] = useState<CatalogItem | null>(null);
  const [addAmount, setAddAmount] = useState(1);
  const [addEnch, setAddEnch] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  // Papelera compartida por servidor en Firestore (filtrada por jugador)
  const trashStore = useStore<{ player: string; reason: string; item: InvSlot }>("trash");
  const trash = useMemo<TrashEntry[]>(() => trashStore.items.filter((t) => t.player.toLowerCase() === loadedFor.toLowerCase()).map((t) => ({ id: t.id, at: t.at, reason: t.reason, item: t.item })), [trashStore.items, loadedFor]);
  const [serverSnaps, setServerSnaps] = useState<{ at: number; items: InvSlot[]; ender: InvSlot[] }[]>([]);
  const loadServerSnaps = (who: string) => apiFetch<{ snapshots: { at: number; items: InvSlot[]; ender: InvSlot[] }[] }>(`/api/backup/snapshots?player=${encodeURIComponent(who)}`).then((r) => setServerSnaps(r.snapshots ?? [])).catch(() => {});
  const loadRef = useRef<() => void>(() => {});
  // Vista: cuadricula (normal o grande) o lista detallada; ademas se puede abrir a pantalla completa
  const [view, setView] = useState<"grid" | "list">("grid");
  const [big, setBig] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { data: modCat } = useModCatalog();
  const look = useMemo(() => lookupFor(modCat), [modCat]);

  const byId = useMemo(() => new Map((catalog?.items ?? []).map((i) => [i.name, i])), [catalog]);
  const bySlot = useMemo(() => new Map((inv ?? []).map((s) => [s.slot, s])), [inv]);
  const version = catalog?.version ?? "1.21";
  const busy = !online || running || reading;
  const validPlayer = !!player.trim() && !player.startsWith("@");

  const load = async (silent = false, before: string[] = []) => {
    if (!validPlayer) { if (!silent) toast.error("Elige un jugador concreto"); return; }
    const who = player.trim();
    setReading(true);
    try {
      const r = await readInventory(who, before).catch((e) => { if (!silent) toast.error((e as Error).message); return null; });
      if (r) {
        setInv(r);
        setHistory(pushSnapshot(who, r));
        if (who !== loadedFor) { setLoadedFor(who); setSel(new Set()); loadServerSnaps(who); }
        else setSel((s) => new Set([...s].filter((slot) => r.some((x) => x.slot === slot)))); // conserva seleccion de slots que siguen ocupados
      } else if (!silent) toast.error("No se pudo leer el inventario", { description: "¿Esta el jugador conectado? Prueba de nuevo." });
    } finally { setReading(false); }
  };
  useEffect(() => { loadRef.current = () => load(true); });

  // Auto-actualizacion opcional (cada 15 s, solo con pestaña visible)
  useEffect(() => {
    if (!auto || !online) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") loadRef.current(); }, 15000);
    return () => clearInterval(t);
  }, [auto, online]);

  // Ejecuta una o varias ordenes y refresca el inventario al terminar
  // Envia las ordenes y la lectura del inventario en una sola sesion de consola (rapido) y refresca
  const act = async (cmds: string[], okMsg?: string) => {
    if (!online) return toast.error("El servidor debe estar en linea");
    await load(false, cmds);
    if (okMsg) toast.success(okMsg);
  };

  const selectedSlots = useMemo(() => [...sel].filter((s) => bySlot.has(s)).sort((a, b) => a - b), [sel, bySlot]);
  const selectedItems = selectedSlots.map((s) => bySlot.get(s)!);
  const nameOf = (it: InvSlot) => it.name ?? (byId.get(it.id) ? label(byId.get(it.id)!) : look.item.get(it.id)?.name ?? it.id);

  const toggle = (slot: number) => setSel((s) => { const n = new Set(s); if (n.has(slot)) n.delete(slot); else n.add(slot); return n; });
  const selectAll = () => setSel(new Set((inv ?? []).map((s) => s.slot)));
  const isSpecial = (it: InvSlot) => it.id.includes(":") || Object.keys(it.enchants).length > 0 || !!it.name || it.extra.length > 0;
  const needsConfirm = selectedItems.length > 3 || selectedItems.some(isSpecial);

  // Quitar SEGURO: se relee el inventario y se comprueba que cada objeto sigue en su sitio; luego se borra por
  // identidad (`clear jugador item cantidad`), nunca por numero de casilla, para no borrar algo que el jugador movio.
  // Lo quitado va a la papelera con su spec exacta para poder devolverlo.
  const removeSelected = async () => {
    if (!online) return toast.error("El servidor debe estar en linea");
    const wanted = selectedItems;
    setReading(true);
    const fresh = await readInventory(loadedFor).catch(() => null);
    setReading(false);
    if (!fresh) return toast.error("No se pudo verificar el inventario; no se quito nada");
    const moved = wanted.filter((it) => { const now = fresh.find((x) => x.slot === it.slot); return !now || now.spec !== it.spec || now.count !== it.count; });
    if (moved.length) {
      setInv(fresh); setSel(new Set());
      return toast.warning("El inventario cambio mientras tanto", { description: `${moved.map(nameOf).join(", ")} ya no esta donde estaba. Revisa la seleccion y vuelve a intentarlo.` });
    }
    await Promise.all(wanted.map((item) => trashStore.put({ player: loadedFor, reason: "Quitado desde el panel", item })));
    await act(wanted.map((it) => `clear ${loadedFor} ${it.spec} ${it.count}`), `${wanted.length} objeto(s) quitado(s) → papelera`);
  };
  const duplicateSelected = () => act(selectedItems.map((it) => giveCmd(loadedFor, it)), `${selectedItems.length} objeto(s) duplicado(s)`);
  const clearAll = async () => {
    if (inv?.length) await Promise.all(inv.map((item) => trashStore.put({ player: loadedFor, reason: "Vaciar todo", item })));
    return act([`clear ${loadedFor}`], "Inventario vaciado → papelera");
  };
  // Devolver con comprobacion real: se lee el inventario ANTES (y, si viene de una copia, se recalcula lo que falta
  // contra el inventario real, no contra la ultima lectura), se envian las ordenes y se relee DESPUES para
  // comprobar objeto a objeto que llegaron. Solo se da por devuelto (y se saca de la papelera) lo verificado.
  const restore = async (items: InvSlot[], trashIds?: string[], snapshot?: InvSlot[]) => {
    if (!online) return toast.error("El servidor debe estar en linea");
    setReading(true);
    const before = await readInventory(loadedFor).catch(() => null);
    if (!before) { setReading(false); return toast.error("No se pudo leer el inventario; no se devolvio nada"); }
    let toGive = items;
    if (snapshot) {
      const still = missingFrom(snapshot, before);
      const want = new Map<string, number>();
      for (const i of items) want.set(i.spec, (want.get(i.spec) ?? 0) + i.count);
      toGive = [];
      for (const i of still) {
        const w = want.get(i.spec) ?? 0;
        const c = Math.min(w, i.count);
        if (c > 0) { toGive.push({ ...i, count: c }); want.set(i.spec, w - c); }
      }
      if (!toGive.length) { setReading(false); setInv(before); setHistory(pushSnapshot(loadedFor, before)); return toast.info("El jugador ya tiene todo lo que pedias"); }
    }
    const count = (l: InvSlot[], spec: string) => l.filter((x) => x.spec === spec).reduce((a, x) => a + x.count, 0);
    const need = new Map<string, number>();
    for (const i of toGive) need.set(i.spec, (need.get(i.spec) ?? 0) + i.count);
    const cmds = toGive.map((it) => giveCmd(loadedFor, it));
    let after = await readInventory(loadedFor, cmds).catch(() => null);
    // un reintento de lectura por si la consola aun no habia aplicado los give
    const arrived = (a: InvSlot[]) => toGive.filter((it) => (count(a, it.spec) - count(before, it.spec)) >= (need.get(it.spec) ?? 0));
    if (after && arrived(after).length < toGive.length) { await new Promise((r) => setTimeout(r, 1500)); after = (await readInventory(loadedFor).catch(() => null)) ?? after; }
    setReading(false);
    if (!after) return toast.error("Se enviaron las ordenes pero no se pudo comprobar el inventario", { description: "No se marco nada como devuelto. Pulsa Leer y revisa." });
    setInv(after); setHistory(pushSnapshot(loadedFor, after));
    const ok = arrived(after);
    const okSpecs = new Set(ok.map((i) => i.spec));
    const failed = toGive.filter((i) => !okSpecs.has(i.spec));
    if (trashIds?.length) {
      const okIds = trashIds.filter((id) => { const t = trash.find((x) => x.id === id); return !t || okSpecs.has(t.item.spec); });
      if (okIds.length) await trashStore.removeMany(okIds);
    }
    if (!failed.length) toast.success(`${toGive.length} objeto(s) devuelto(s) y verificados en el inventario de ${loadedFor}`);
    else toast.warning(`Llegaron ${ok.length} de ${toGive.length} objetos`, { description: `No aparecen en el inventario: ${failed.map((i) => `${nameOf(i)} x${i.count}`).join(", ")}. ¿Inventario lleno o jugador desconectado? Vuelve a intentarlo.` });
  };

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return (catalog?.items ?? []).filter((i) => i.name.includes(n) || i.displayName.toLowerCase().includes(n) || (i.es ?? "").toLowerCase().includes(n)).slice(0, 24);
  }, [catalog, q]);

  const give = () => addItem && loadedFor && act([buildGive({ item: addItem.name, amount: addAmount, target: loadedFor, ench: addEnch ? recommendedFor(addItem.name, catalog) : {}, version })], `${label(addItem)} x${addAmount} agregado`);

  const slotProps = (slot: number) => { const it = bySlot.get(slot); return { it, meta: it ? byId.get(it.id) : undefined, version, selected: sel.has(slot), toggle, catalog, look }; };

  const renderGrid = (large: boolean) => (
    <div className="flex gap-3">
      <div className={cn("grid shrink-0 grid-cols-1 gap-1", large ? "w-16" : "w-12")}>
        {ARMOR.map((a) => <Slot key={a.slot} slot={a.slot} {...slotProps(a.slot)} big={large} hint={a.label} Icon={Shield} />)}
        <Slot slot={-106} {...slotProps(-106)} big={large} hint="Mano secundaria" Icon={Hand} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Inventario principal</p>
        <div className="grid grid-cols-9 gap-1">{Array.from({ length: 27 }, (_, i) => <Slot key={i + 9} slot={i + 9} {...slotProps(i + 9)} big={large} />)}</div>
        <p className="pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Barra rapida</p>
        <div className="grid grid-cols-9 gap-1">{Array.from({ length: 9 }, (_, i) => <Slot key={i} slot={i} {...slotProps(i)} big={large} />)}</div>
      </div>
    </div>
  );

  // Lista detallada: un objeto por fila con icono, nombre, cantidad y encantamientos con su nombre y nivel
  const groups: { title: string; test: (n: number) => boolean }[] = [
    { title: "Armadura y mano secundaria", test: (n) => n >= 100 || n < 0 },
    { title: "Barra rapida", test: (n) => n >= 0 && n <= 8 },
    { title: "Inventario principal", test: (n) => n >= 9 && n <= 35 },
    { title: "Otros", test: (n) => n > 35 && n < 100 },
  ];
  const renderList = () => (
    <div className="space-y-3">
      {groups.map((g) => {
        const items = (inv ?? []).filter((it) => g.test(it.slot)).sort((a, b) => b.slot >= 100 && a.slot >= 100 ? b.slot - a.slot : a.slot - b.slot);
        if (!items.length) return null;
        return (
          <div key={g.title} className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{g.title}</p>
            {items.map((it) => {
              const on = sel.has(it.slot);
              const ench = Object.entries(it.enchants);
              return (
                <button key={it.slot} onClick={() => toggle(it.slot)}
                  className={cn("flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary/40", on && "border-primary bg-primary/10")}>
                  <ItemIcon id={it.id} version={version} look={look} className="size-10 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate font-medium">{nameOf(it)}</span>
                      {it.count > 1 && <span className="font-mono text-sm text-muted-foreground">x{it.count}</span>}
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">{slotLabel(it.slot)}</span>
                    </span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">{it.id}</span>
                    {ench.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {ench.map(([k, v]) => <Badge key={k} variant="outline" className="h-5 border-chart-5/40 px-1.5 text-[10px] text-chart-5">{enchName(k, catalog, look)} {v}</Badge>)}
                      </span>
                    )}
                    {it.extra.length > 0 && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground" title={it.extra.join(", ")}>{it.extra.join(" · ")}</span>}
                  </span>
                  {on && <CheckSquare className="size-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        );
      })}
      {inv?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Inventario vacio.</p>}
    </div>
  );

  const viewControls = (
    <div className="flex items-center gap-1">
      <Button size="xs" variant={view === "grid" ? "default" : "ghost"} onClick={() => setView("grid")} title="Cuadricula"><LayoutGrid /></Button>
      <Button size="xs" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")} title="Lista detallada"><List /></Button>
      {view === "grid" && <Button size="xs" variant={big ? "default" : "ghost"} onClick={() => setBig((b) => !b)} title="Casillas grandes"><ZoomIn /></Button>}
      <Button size="xs" variant="ghost" onClick={() => setExpanded(true)} title="Pantalla completa"><Maximize2 /></Button>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-[96vw] flex-col sm:max-w-[96vw]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Backpack className="size-4 text-primary" />Inventario de {loadedFor || "—"}</DialogTitle><DialogDescription>Cuadricula grande y lista detallada a la vez. Haz clic para seleccionar; las acciones estan en el panel de la derecha de la pagina.</DialogDescription></DialogHeader>
          {inv && (
            <div className="grid min-h-0 flex-1 gap-4 overflow-auto lg:grid-cols-2">
              <div className="min-w-0">{renderGrid(true)}</div>
              <div className="min-w-0">{renderList()}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Backpack className="size-4 text-primary" />Inventario{loadedFor && <span className="font-mono text-sm font-normal text-muted-foreground">de {loadedFor}</span>}{reading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}</CardTitle>
          <CardDescription>Tiempo real; se actualiza sola tras cada accion. Al quitar se verifica que nada se movio y se borra por objeto (no por casilla); lo quitado va a la papelera.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Jugador</Label>
              <TargetPicker value={player} onChange={setPlayer} players={players} allowSelectors={false} />
            </div>
            <Button onClick={() => load()} disabled={busy || !validPlayer}>{reading ? <Loader2 className="animate-spin" /> : <RefreshCw />}{inv && loadedFor === player.trim() ? "Actualizar" : "Leer inventario"}</Button>
          </div>

          {inv === null ? (
            <div className="grid place-items-center rounded-lg border border-dashed py-14 text-sm text-muted-foreground">Elige un jugador conectado y pulsa &quot;Leer inventario&quot;.</div>
          ) : (
            <div className={cn("space-y-3 transition-opacity", reading && "opacity-60")}>
              {view === "grid" ? renderGrid(big) : renderList()}
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <Badge variant="secondary">{inv.length} objetos · {inv.reduce((a, s) => a + s.count, 0)} unidades</Badge>
                {viewControls}
                <Button size="xs" variant="ghost" onClick={selectAll} disabled={inv.length === 0}><CheckSquare />Seleccionar todo</Button>
                <Button size="xs" variant="ghost" onClick={() => setSel(new Set())} disabled={sel.size === 0}><Square />Limpiar</Button>
                <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><Timer className="size-3.5" />Auto cada 15 s <Switch checked={auto} onCheckedChange={setAuto} /></label>
                <AlertDialog>
                  <AlertDialogTrigger render={<Button size="sm" variant="destructive" disabled={busy || inv.length === 0} />}><Eraser />Vaciar todo</AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Vaciar el inventario de {loadedFor}?</AlertDialogTitle><AlertDialogDescription>Se borraran los {inv.length} objetos, incluida la armadura equipada. No se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={clearAll}>Vaciar</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
        {/* Seleccion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">Seleccion {selectedItems.length > 0 && <Badge>{selectedItems.length}</Badge>}</CardTitle>
            <CardDescription>{selectedItems.length ? `${selectedItems.reduce((a, s) => a + s.count, 0)} unidades en ${selectedItems.length} slot(s)` : "Haz clic en uno o varios slots con objeto"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedItems.length > 0 ? (
              <>
                <ul className="max-h-48 space-y-1 overflow-auto pr-1">
                  {selectedItems.map((it) => (
                    <li key={it.slot} className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                      <span className="min-w-0 flex-1 truncate">{nameOf(it)} <span className="text-muted-foreground">x{it.count}</span>{Object.keys(it.enchants).length > 0 && <Sparkles className="ml-1 inline size-3 text-chart-5" />}{it.id.includes(":") && <Badge variant="outline" className="ml-1 h-4 border-chart-3/50 px-1 text-[9px] text-chart-3">mod</Badge>}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">slot {it.slot}</span>
                      <Button size="icon-xs" variant="ghost" onClick={() => toggle(it.slot)}>×</Button>
                    </li>
                  ))}
                </ul>
                {selectedItems.length === 1 && Object.keys(selectedItems[0].enchants).length > 0 && (
                  <div className="flex flex-wrap gap-1">{Object.entries(selectedItems[0].enchants).map(([k, v]) => <Badge key={k} variant="outline" className="border-chart-5/40 text-chart-5">{catalog?.enchantments.find((e) => e.name === k)?.es ?? k} {v}</Badge>)}</div>
                )}
                <div className="flex flex-wrap gap-2">
                  {needsConfirm ? (
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="destructive" disabled={busy} />}><Trash2 />Quitar {selectedItems.length}</AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Quitar {selectedItems.length} objeto(s)?</AlertDialogTitle><AlertDialogDescription>{selectedItems.map(nameOf).join(", ")}.{selectedItems.some((it) => it.id.includes(":")) && <><br /><b>Incluye objetos de mods</b> (mochilas, etc.). Se guardan en la papelera con su ID interno y se pueden devolver.</>}{selectedItems.some((it) => Object.keys(it.enchants).length > 0 || it.name) && <><br />Incluye objetos encantados o con nombre.</>}</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={removeSelected}>Quitar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button variant="destructive" onClick={removeSelected} disabled={busy}><Trash2 />Quitar{selectedItems.length > 1 ? ` ${selectedItems.length}` : ""}</Button>
                  )}
                  <Button variant="outline" onClick={duplicateSelected} disabled={busy}><Copy />Duplicar</Button>
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">Selecciona objetos de la cuadricula para quitarlos o duplicarlos en bloque.</p>}
          </CardContent>
        </Card>

        {/* Agregar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4 text-primary" />Agregar objeto</CardTitle>
            <CardDescription>{loadedFor ? <>Se entrega a <span className="font-mono">{loadedFor}</span></> : "Lee primero un inventario"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar item (espada, diamante, pan…)" className="pl-8" />
            </div>
            {results.length > 0 && (
              <div className="grid max-h-44 gap-1 overflow-auto pr-1">
                {results.map((i) => (
                  <button key={i.name} onClick={() => { setAddItem(i); setQ(""); }} className="flex items-center gap-2 rounded-md border px-2 py-1 text-left text-xs hover:border-primary/40 hover:bg-primary/5">
                    <span className="truncate">{label(i)}</span><span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">{i.name}</span>
                  </button>
                ))}
              </div>
            )}
            {addItem && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">{label(addItem)} <span className="font-mono text-xs text-muted-foreground">{addItem.name}</span></p>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} value={addAmount} onChange={(e) => setAddAmount(Math.max(1, Number(e.target.value) || 1))} className="w-24 font-mono" />
                  <Button size="sm" variant="outline" onClick={() => setAddAmount(addItem.stackSize)}>{addItem.stackSize}</Button>
                  {Object.keys(recommendedFor(addItem.name, catalog)).length > 0 && (
                    <Button size="sm" variant={addEnch ? "default" : "outline"} onClick={() => setAddEnch((v) => !v)}><Sparkles />Encantado</Button>
                  )}
                </div>
                <Button className="w-full" onClick={give} disabled={busy || !loadedFor}><Plus />Agregar al inventario</Button>
              </div>
            )}
          </CardContent>
        </Card>
        <RecoveryCard version={version} catalog={catalog} look={look} player={loadedFor} current={inv} history={history} serverSnapshots={serverSnaps} trash={trash} nameOf={nameOf} busy={busy}
          onRestore={restore} onDropTrash={(ids) => trashStore.removeMany(ids).catch((e) => toast.error((e as Error).message))} onClearTrash={() => trashStore.removeMany(trash.map((t) => t.id)).catch((e) => toast.error((e as Error).message))} />
        <BackupsCard onRan={() => loadedFor && loadServerSnaps(loadedFor)} />
      </div>
    </div>
  );
}

function Slot({ slot, hint, Icon, it, meta, version, selected, toggle, catalog, look, big }: { slot: number; hint?: string; Icon?: React.ElementType; it?: InvSlot; meta?: CatalogItem; version: string; selected: boolean; toggle: (s: number) => void; catalog: Catalog | null; look: Lookup; big?: boolean }) {
  const enchN = it ? Object.keys(it.enchants).length : 0;
  const cell = (
    <button onClick={() => it && toggle(slot)} disabled={!it}
      className={cn("relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border bg-black/40 transition-colors",
        it ? "hover:border-primary/50" : "border-dashed border-white/10", selected && "border-primary bg-primary/15 ring-1 ring-primary/60", enchN > 0 && !selected && "shadow-[inset_0_0_0_1px_oklch(0.75_0.15_300/60%)]")}>
      {it ? (
        <>
          <ItemIcon id={it.id} version={version} look={look} className={big ? "size-11" : "size-7"} fallback={(meta ? label(meta) : look.item.get(it.id)?.name ?? it.id.split(":").pop() ?? it.id).slice(0, 14)} />
          {it.count > 1 && <span className={cn("absolute bottom-0.5 right-1 font-mono font-semibold drop-shadow", big ? "text-sm" : "text-[11px]")}>{it.count}</span>}
          {enchN > 0 && <Sparkles className="absolute left-0.5 top-0.5 size-3 text-chart-5" />}
          {selected && <CheckSquare className="absolute right-0.5 top-0.5 size-3 text-primary" />}
        </>
      ) : Icon ? <Icon className="size-4 text-white/15" /> : null}
    </button>
  );
  return (
    <Tooltip>
      <TooltipTrigger render={<div />}>{cell}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-56">
        {it ? (
          <div className="space-y-0.5">
            <p className="font-medium">{it.name ?? (meta ? label(meta) : look.item.get(it.id)?.name ?? it.id)} {it.count > 1 && `x${it.count}`}</p>
            <p className="font-mono text-[10px] opacity-70">{it.id}{hint ? ` · ${hint}` : ` · slot ${slot}`}</p>
            {enchN > 0 && <p className="text-[11px]">{Object.entries(it.enchants).map(([k, v]) => `${enchName(k, catalog, look)} ${v}`).join(", ")}</p>}
            {it.extra.length > 0 && <p className="text-[10px] opacity-60">{it.extra.join(", ")}</p>}
          </div>
        ) : <span className="text-xs opacity-70">{hint ?? `Slot ${slot}`} vacio</span>}
      </TooltipContent>
    </Tooltip>
  );
}
