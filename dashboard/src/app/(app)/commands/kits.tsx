"use client";
import { useState } from "react";
import { PackagePlus, Gift, Trash2, Loader2, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TargetPicker } from "@/components/target-picker";
import { useCommands } from "@/components/command-runner";
import { useStore } from "@/hooks/use-store";
import { apiFetch } from "@/lib/client";
import { giveCmd } from "@/lib/inventory-store";
import { cn } from "@/lib/utils";
import type { InvSlot } from "@/lib/snbt";
import { ItemIcon, lookupFor, type Lookup } from "./item-visuals";
import { useModCatalog } from "@/hooks/use-mod-catalog";
import { useMemo } from "react";

type Kit = { name: string; items: InvSlot[] };
const label = (i: InvSlot) => i.name ?? i.id.replace(/^[^:]*:/, "").replace(/_/g, " ");

// Kits: conjuntos de objetos guardados (se crean desde el inventario real de un jugador) que se pueden dar a quien quieras
export function KitsCommand({ players, version }: { players: string[]; version: string }) {
  const { run, online, running } = useCommands();
  const store = useStore<Kit>("kits");
  const { data: modCat } = useModCatalog();
  const look: Lookup = useMemo(() => lookupFor(modCat), [modCat]);
  const [target, setTarget] = useState(players[0] ?? "");
  const [from, setFrom] = useState(players[0] ?? "");
  const [inv, setInv] = useState<InvSlot[] | null>(null);
  const [sel, setSel] = useState<Set<number>>(() => new Set());
  const [name, setName] = useState("");
  const [reading, setReading] = useState(false);
  const [giving, setGiving] = useState<string | null>(null);

  const read = async () => {
    if (!from.trim() || from.startsWith("@")) return toast.error("Elige un jugador concreto");
    setReading(true);
    try {
      const r = await apiFetch<{ slots: InvSlot[] }>("/api/server/inventory", { method: "POST", body: JSON.stringify({ player: from.trim(), before: [] }) });
      setInv(r.slots); setSel(new Set());
    } catch (e) { toast.error((e as Error).message); }
    finally { setReading(false); }
  };
  const toggle = (slot: number) => setSel((s) => { const n = new Set(s); if (n.has(slot)) n.delete(slot); else n.add(slot); return n; });
  const save = async () => {
    const items = (inv ?? []).filter((i) => sel.has(i.slot));
    if (!name.trim() || !items.length) return toast.error("Pon un nombre y marca al menos un objeto");
    try { await store.put({ name: name.trim(), items }); toast.success(`Kit "${name.trim()}" guardado (${items.length} objetos)`); setName(""); setSel(new Set()); }
    catch (e) { toast.error((e as Error).message); }
  };
  const give = async (k: { id: string } & Kit) => {
    if (!target.trim()) return toast.error("Elige a quien dar el kit");
    setGiving(k.id);
    let ok = 0;
    for (const it of k.items) if (await run(giveCmd(target.trim(), it), { quiet: true })) ok++;
    setGiving(null);
    if (ok === k.items.length) toast.success(`Kit "${k.name}" entregado a ${target}`);
    else toast.warning(`Kit "${k.name}": ${ok} de ${k.items.length} objetos enviados`, { description: "Revisa el historial de comandos." });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Gift className="size-4 text-primary" />Kits guardados {store.items.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{store.items.length}</Badge>}</CardTitle>
          <CardDescription>Elige a quien darlo y pulsa Dar. Cada objeto se genera exacto, con sus encantamientos y componentes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <TargetPicker value={target} onChange={setTarget} players={players} allowSelectors />
          {store.items.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Aun no hay kits. Crea uno desde el inventario de un jugador →</p>}
          <ul className="space-y-2">
            {store.items.map((k) => (
              <li key={k.id} className="rounded-lg border p-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{k.name}</span>
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">{k.items.length} obj.</Badge>
                  <Button size="xs" className="ml-auto" disabled={!online || running || giving !== null} onClick={() => give(k)}>{giving === k.id ? <Loader2 className="animate-spin" /> : <Gift />}Dar</Button>
                  <Button size="icon-xs" variant="ghost" onClick={() => store.remove(k.id).catch((e) => toast.error((e as Error).message))} title="Borrar kit"><Trash2 /></Button>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {k.items.slice(0, 18).map((i, n) => (
                    <span key={n} className="relative" title={`${label(i)} x${i.count}`}>
                      <ItemIcon id={i.id} version={version} look={look} className="size-7" fallback={label(i)} />
                      {i.count > 1 && <span className="absolute -bottom-1 -right-0.5 rounded bg-background/80 px-0.5 font-mono text-[9px]">{i.count}</span>}
                    </span>
                  ))}
                  {k.items.length > 18 && <span className="self-center text-[10px] text-muted-foreground">+{k.items.length - 18}</span>}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><PackagePlus className="size-4 text-primary" />Crear kit</CardTitle>
          <CardDescription>Lee el inventario de un jugador conectado, marca los objetos y ponle nombre.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <TargetPicker value={from} onChange={setFrom} players={players} allowSelectors={false} />
          <Button size="sm" variant="outline" onClick={read} disabled={!online || reading}>{reading ? <Loader2 className="animate-spin" /> : <Download />}Leer inventario</Button>
          {inv && (
            <>
              <ul className="max-h-72 space-y-1 overflow-auto pr-1">
                {inv.map((i) => (
                  <li key={i.slot}>
                    <button onClick={() => toggle(i.slot)} className={cn("flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-xs hover:border-primary/40", sel.has(i.slot) && "border-primary bg-primary/10")}>
                      <ItemIcon id={i.id} version={version} look={look} className="size-6" fallback={label(i)} />
                      <span className="min-w-0 flex-1 truncate">{label(i)} <span className="text-muted-foreground">x{i.count}</span></span>
                      {Object.keys(i.enchants).length > 0 && <Sparkles className="size-3 text-chart-5" />}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button size="xs" variant="ghost" onClick={() => setSel(new Set(inv.map((i) => i.slot)))}>Marcar todo</Button>
                <Button size="xs" variant="ghost" onClick={() => setSel(new Set())}>Ninguno</Button>
              </div>
              <div className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del kit" className="h-8" maxLength={40} />
                <Button size="sm" onClick={save} disabled={!name.trim() || sel.size === 0}>Guardar ({sel.size})</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
