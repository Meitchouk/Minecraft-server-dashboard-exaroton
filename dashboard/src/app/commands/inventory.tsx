"use client";
import { useMemo, useState } from "react";
import { Backpack, RefreshCw, Trash2, Plus, Search, Loader2, Shield, Hand, Sparkles, Eraser } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TargetPicker } from "@/components/target-picker";
import { useCommands } from "@/components/command-runner";
import { label, type Catalog, type CatalogItem } from "@/hooks/use-catalog";
import { apiFetch } from "@/lib/client";
import { parseInventory, type InvSlot } from "@/lib/snbt";
import { buildGive, recommendedFor } from "./give";
import { cn } from "@/lib/utils";

// Slots del inventario vanilla: 0-8 hotbar, 9-35 principal, 100-103 armadura (pies..cabeza), -106 mano secundaria
const ARMOR: { slot: number; label: string; path: string }[] = [
  { slot: 103, label: "Casco", path: "armor.head" },
  { slot: 102, label: "Pechera", path: "armor.chest" },
  { slot: 101, label: "Pantalones", path: "armor.legs" },
  { slot: 100, label: "Botas", path: "armor.feet" },
];
const slotPath = (slot: number) => slot === -106 ? "weapon.offhand" : ARMOR.find((a) => a.slot === slot)?.path ?? `container.${slot}`;

// Lee el inventario real: `data get` + busca la respuesta en el log (una linea con "Slot:" o "[]")
async function readInventory(run: (c: string) => Promise<boolean>, player: string): Promise<InvSlot[] | null> {
  if (!(await run(`data get entity ${player} Inventory`))) return null;
  await new Promise((r) => setTimeout(r, 1300));
  const { content } = await apiFetch<{ content: string }>("/api/server/logs");
  const esc = player.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${esc} has the following entity data: (\\[.*)$`);
  const line = content.split("\n").reverse().find((l) => { const m = l.match(re); return m && (m[1].includes("Slot:") || m[1].trim() === "[]"); });
  const m = line?.match(re);
  if (!m) return null;
  try { return parseInventory(m[1].trim()); } catch (e) { toast.error("No se pudo interpretar el inventario", { description: (e as Error).message }); return null; }
}

export function InventoryCommand({ catalog, players }: { catalog: Catalog | null; players: string[] }) {
  const { run, online, running } = useCommands();
  const [player, setPlayer] = useState(players[0] ?? "");
  const [inv, setInv] = useState<InvSlot[] | null>(null);
  const [loadedFor, setLoadedFor] = useState("");
  const [reading, setReading] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [addItem, setAddItem] = useState<CatalogItem | null>(null);
  const [addAmount, setAddAmount] = useState(1);
  const [addEnch, setAddEnch] = useState(false);

  const byId = useMemo(() => new Map((catalog?.items ?? []).map((i) => [i.name, i])), [catalog]);
  const bySlot = useMemo(() => new Map((inv ?? []).map((s) => [s.slot, s])), [inv]);
  const version = catalog?.version ?? "1.21";
  const busy = !online || running || reading;
  const validPlayer = !!player.trim() && !player.startsWith("@");

  const load = async () => {
    if (!validPlayer) return toast.error("Elige un jugador concreto");
    setReading(true);
    try {
      const r = await readInventory(run, player.trim());
      if (r) { setInv(r); setLoadedFor(player.trim()); setSel(null); }
      else toast.error("No se pudo leer el inventario", { description: "¿Esta el jugador conectado? Prueba de nuevo." });
    } finally { setReading(false); }
  };

  const after = () => setTimeout(load, 400);

  const removeSlot = async (slot: number) => {
    const ok = await run(`item replace entity ${loadedFor} ${slotPath(slot)} with minecraft:air`);
    if (ok) after();
  };
  const clearAll = async () => { if (await run(`clear ${loadedFor}`)) after(); };

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return (catalog?.items ?? []).filter((i) => i.name.includes(n) || i.displayName.toLowerCase().includes(n) || (i.es ?? "").toLowerCase().includes(n)).slice(0, 24);
  }, [catalog, q]);

  const give = async () => {
    if (!addItem || !loadedFor) return;
    const ok = await run(buildGive({ item: addItem.name, amount: addAmount, target: loadedFor, ench: addEnch ? recommendedFor(addItem.name, catalog) : {}, version }));
    if (ok) after();
  };

  const slotProps = (slot: number) => { const it = bySlot.get(slot); return { it, meta: it ? byId.get(it.id) : undefined, version, sel, setSel, catalog }; };

  const selected = sel !== null ? bySlot.get(sel) : undefined;
  const selMeta = selected ? byId.get(selected.id) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Backpack className="size-4 text-primary" />Inventario{loadedFor && <span className="font-mono text-sm font-normal text-muted-foreground">de {loadedFor}</span>}</CardTitle>
          <CardDescription>Se lee con <code className="rounded bg-muted px-1">data get</code> desde el log del servidor. Pasa el raton por un slot para ver detalles; haz clic para seleccionarlo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Jugador</Label>
              <TargetPicker value={player} onChange={setPlayer} players={players} allowSelectors={false} />
            </div>
            <Button onClick={load} disabled={busy || !validPlayer}>{reading ? <Loader2 className="animate-spin" /> : <RefreshCw />}{inv && loadedFor === player.trim() ? "Actualizar" : "Leer inventario"}</Button>
          </div>

          {inv === null ? (
            <div className="grid place-items-center rounded-lg border border-dashed py-14 text-sm text-muted-foreground">Elige un jugador conectado y pulsa &quot;Leer inventario&quot;.</div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="grid w-12 shrink-0 grid-cols-1 gap-1">
                  {ARMOR.map((a) => <Slot key={a.slot} slot={a.slot} {...slotProps(a.slot)} hint={a.label} Icon={Shield} />)}
                  <Slot slot={-106} {...slotProps(-106)} hint="Mano secundaria" Icon={Hand} />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Inventario principal</p>
                  <div className="grid grid-cols-9 gap-1">{Array.from({ length: 27 }, (_, i) => <Slot key={i + 9} slot={i + 9} {...slotProps(i + 9)} />)}</div>
                  <p className="pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Barra rapida</p>
                  <div className="grid grid-cols-9 gap-1">{Array.from({ length: 9 }, (_, i) => <Slot key={i} slot={i} {...slotProps(i)} />)}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <Badge variant="secondary">{inv.length} objetos · {inv.reduce((a, s) => a + s.count, 0)} unidades</Badge>
                <AlertDialog>
                  <AlertDialogTrigger render={<Button size="sm" variant="destructive" className="ml-auto" disabled={busy || inv.length === 0} />}><Eraser />Vaciar todo</AlertDialogTrigger>
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
        {/* Seleccionado */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Objeto seleccionado</CardTitle>
            <CardDescription>{selected ? <span className="font-mono">{selected.id} · slot {sel}</span> : "Haz clic en un slot con objeto"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selected ? (
              <>
                <p className="text-lg font-medium">{selected.name ?? (selMeta ? label(selMeta) : selected.id)} <span className="text-sm text-muted-foreground">x{selected.count}</span></p>
                {Object.keys(selected.enchants).length > 0 && (
                  <div className="flex flex-wrap gap-1">{Object.entries(selected.enchants).map(([k, v]) => <Badge key={k} variant="outline" className="border-chart-5/40 text-chart-5">{catalog?.enchantments.find((e) => e.name === k)?.es ?? k} {v}</Badge>)}</div>
                )}
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => removeSlot(sel!)} disabled={busy}><Trash2 />Quitar del inventario</Button>
                  <Button variant="outline" onClick={() => run(`give ${loadedFor} ${selected.id.includes(":") ? selected.id : `minecraft:${selected.id}`} ${selected.count}`).then((ok) => ok && after())} disabled={busy} title="Duplicar">+{selected.count}</Button>
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">Selecciona un objeto de la cuadricula para quitarlo o duplicarlo.</p>}
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
      </div>
    </div>
  );
}

function Slot({ slot, hint, Icon, it, meta, version, sel, setSel, catalog }: { slot: number; hint?: string; Icon?: React.ElementType; it?: InvSlot; meta?: CatalogItem; version: string; sel: number | null; setSel: (s: number | null) => void; catalog: Catalog | null }) {
  const enchN = it ? Object.keys(it.enchants).length : 0;
  const cell = (
    <button onClick={() => setSel(it ? slot : null)}
      className={cn("relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border bg-black/40 transition-colors",
        it ? "hover:border-primary/50" : "border-dashed border-white/10", sel === slot && "border-primary bg-primary/10", enchN > 0 && "shadow-[inset_0_0_0_1px_oklch(0.75_0.15_300/60%)]")}>
      {it ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://mc.nerothe.com/img/${version.startsWith("1.") ? version : "1.21.4"}/minecraft_${it.id}.png`} alt="" className="size-7 [image-rendering:pixelated]" loading="lazy"
            onError={(e) => { const el = e.currentTarget as HTMLImageElement; el.style.display = "none"; el.nextElementSibling?.classList.remove("hidden"); }} />
          <span className="hidden max-w-full break-all px-0.5 text-center text-[8px] leading-tight">{(meta ? label(meta) : it.id.split(":").pop() ?? it.id).slice(0, 14)}</span>
          {it.count > 1 && <span className="absolute bottom-0.5 right-1 font-mono text-[11px] font-semibold drop-shadow">{it.count}</span>}
          {enchN > 0 && <Sparkles className="absolute left-0.5 top-0.5 size-3 text-chart-5" />}
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
            <p className="font-medium">{it.name ?? (meta ? label(meta) : it.id)} {it.count > 1 && `x${it.count}`}</p>
            <p className="font-mono text-[10px] opacity-70">{it.id}{hint ? ` · ${hint}` : ` · slot ${slot}`}</p>
            {enchN > 0 && <p className="text-[11px]">{Object.entries(it.enchants).map(([k, v]) => `${catalog?.enchantments.find((e) => e.name === k)?.es ?? k} ${v}`).join(", ")}</p>}
            {it.extra.length > 0 && <p className="text-[10px] opacity-60">{it.extra.join(", ")}</p>}
          </div>
        ) : <span className="text-xs opacity-70">{hint ?? `Slot ${slot}`} vacio</span>}
      </TooltipContent>
    </Tooltip>
  );
};

