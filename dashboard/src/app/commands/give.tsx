"use client";
import { useMemo, useState } from "react";
import { Search, Gift, Sparkles, Plus, X, Copy, Clock, Package } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TargetPicker } from "@/components/target-picker";
import { useCommands } from "@/components/command-runner";
import { loadLS, saveLS, versionAtLeast, type Catalog } from "@/hooks/use-catalog";
import { cn } from "@/lib/utils";

const RECENT_KEY = "exaroton.give.recent";
const CUSTOM_KEY = "exaroton.give.custom";
const PAGE = 120;

type Item = Catalog["items"][number];

export function GiveCommand({ catalog, loading, players }: { catalog: Catalog | null; loading: boolean; players: string[] }) {
  const { run, online, running } = useCommands();
  const [q, setQ] = useState("");
  const [item, setItem] = useState<Item | null>(null);
  const [amount, setAmount] = useState(1);
  const [target, setTarget] = useState(players[0] ?? "@p");
  const [ench, setEnch] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [unbreakable, setUnbreakable] = useState(false);
  const [showEnch, setShowEnch] = useState(false);
  const [enchQ, setEnchQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [recent, setRecent] = useState<string[]>(() => loadLS(RECENT_KEY, []));
  const [custom, setCustom] = useState<string[]>(() => loadLS(CUSTOM_KEY, []));
  const [customInput, setCustomInput] = useState("");

  const version = catalog?.version ?? "1.21";
  const components = versionAtLeast(version, "1.20.5"); // sintaxis item[component=...] vs NBT
  const plainName = versionAtLeast(version, "1.21.5");   // custom_name acepta string plano

  const items = useMemo<Item[]>(() => {
    const base = catalog?.items ?? [];
    const customItems = custom.map((c) => ({ name: c, displayName: c, stackSize: 64 }));
    const all = [...customItems, ...base];
    const needle = q.trim().toLowerCase().replace(/^minecraft:/, "");
    if (!needle) return all;
    return all.filter((i) => i.name.includes(needle) || i.displayName.toLowerCase().includes(needle));
  }, [catalog, q, custom]);

  const enchList = useMemo(() => {
    const all = catalog?.enchantments ?? [];
    const n = enchQ.trim().toLowerCase();
    return n ? all.filter((e) => e.name.includes(n) || e.displayName.toLowerCase().includes(n)) : all;
  }, [catalog, enchQ]);

  const itemId = item ? (item.name.includes(":") ? item.name : `minecraft:${item.name}`) : "";

  const command = useMemo(() => {
    if (!item) return "";
    const enchEntries = Object.entries(ench).filter(([, l]) => l > 0);
    if (components) {
      const parts: string[] = [];
      if (enchEntries.length) parts.push(`enchantments={${enchEntries.map(([k, l]) => `"minecraft:${k}":${l}`).join(",")}}`);
      if (name.trim()) parts.push(plainName ? `custom_name="${name.trim().replace(/"/g, '\\"')}"` : `custom_name='{"text":"${name.trim().replace(/"/g, '\\"')}"}'`);
      if (unbreakable) parts.push(plainName ? "unbreakable={}" : "unbreakable={}");
      return `give ${target.trim()} ${itemId}${parts.length ? `[${parts.join(",")}]` : ""} ${amount}`;
    }
    const nbt: string[] = [];
    if (enchEntries.length) nbt.push(`Enchantments:[${enchEntries.map(([k, l]) => `{id:"minecraft:${k}",lvl:${l}s}`).join(",")}]`);
    if (name.trim()) nbt.push(`display:{Name:'{"text":"${name.trim().replace(/"/g, '\\"')}"}'}`);
    if (unbreakable) nbt.push("Unbreakable:1b");
    return `give ${target.trim()} ${itemId}${nbt.length ? `{${nbt.join(",")}}` : ""} ${amount}`;
  }, [item, itemId, ench, name, unbreakable, target, amount, components, plainName]);

  const give = async () => {
    if (!item) return;
    const ok = await run(command);
    if (ok) {
      const r = [item.name, ...recent.filter((x) => x !== item.name)].slice(0, 12);
      setRecent(r); saveLS(RECENT_KEY, r);
    }
  };

  const addCustom = () => {
    const v = customInput.trim().toLowerCase();
    if (!v) return;
    const c = [v, ...custom.filter((x) => x !== v)];
    setCustom(c); saveLS(CUSTOM_KEY, c); setCustomInput("");
    setItem({ name: v, displayName: v, stackSize: 64 });
    toast.success(`Item personalizado agregado: ${v}`);
  };

  const pick = (i: Item) => { setItem(i); setEnch({}); setAmount(1); };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Item browser */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="size-4 text-primary" />Items</CardTitle>
          <CardDescription>
            {loading ? "Cargando catalogo…" : catalog ? <>{catalog.items.length} items vanilla · version <b>{catalog.version}</b>{catalog.requested && catalog.requested !== catalog.version && <> (servidor {catalog.requested}, usando la mas cercana)</>}</> : "Sin catalogo"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Buscar: diamond_sword, Elytra, netherite…" className="pl-8" autoFocus />
          </div>

          {recent.length > 0 && !q && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              {recent.map((r) => {
                const it = items.find((i) => i.name === r) ?? { name: r, displayName: r, stackSize: 64 };
                return <Button key={r} size="xs" variant={item?.name === r ? "default" : "secondary"} onClick={() => pick(it)}>{it.displayName}</Button>;
              })}
            </div>
          )}

          {loading ? <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">{[...Array(12)].map((_, i) => <Skeleton key={i} className="h-9" />)}</div> : (
            <>
              <div className="grid max-h-[46vh] gap-1.5 overflow-auto pr-1 sm:grid-cols-2 md:grid-cols-3">
                {items.slice(0, limit).map((i) => (
                  <button key={i.name} onClick={() => pick(i)}
                    className={cn("flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5",
                      item?.name === i.name && "border-primary bg-primary/10")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://mc.nerothe.com/img/${version.startsWith("1.") ? version : "1.21.4"}/minecraft_${i.name}.png`} alt="" width={20} height={20} className="size-5 shrink-0 [image-rendering:pixelated]"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{i.displayName}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">{i.name}</span>
                    </span>
                  </button>
                ))}
                {items.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Sin resultados. ¿Es un item de mod? Agregalo abajo con su ID (ej. <code>modid:item</code>).</p>}
              </div>
              {items.length > limit && <Button variant="ghost" size="sm" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>Mostrar mas ({items.length - limit} restantes)</Button>}
            </>
          )}

          <div className="flex gap-2 border-t pt-3">
            <Input value={customInput} onChange={(e) => setCustomInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder="ID de item de mod (ej. create:brass_ingot)" className="font-mono text-xs" />
            <Button variant="outline" onClick={addCustom} disabled={!customInput.trim()}><Plus />Agregar</Button>
          </div>
          {catalog && catalog.mods.length > 0 && (
            <p className="text-xs text-muted-foreground">Mods detectados en /mods: {catalog.mods.slice(0, 8).map((m) => m.replace(/\.jar$/, "")).join(", ")}{catalog.mods.length > 8 && ` y ${catalog.mods.length - 8} mas`}. Sus items no estan en el catalogo vanilla; agregalos por ID.</p>
          )}
        </CardContent>
      </Card>

      {/* Builder */}
      <Card className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Gift className="size-4 text-primary" />Dar item</CardTitle>
          <CardDescription>{item ? <span className="font-mono">{itemId}</span> : "Selecciona un item de la lista"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Para</Label>
            <TargetPicker value={target} onChange={setTarget} players={players} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Cantidad</Label>
              <div className="flex gap-1">
                <Input type="number" min={1} max={6400} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} className="font-mono" />
                <Button variant="outline" size="icon" onClick={() => setAmount(item?.stackSize ?? 64)} title="Un stack">{item?.stackSize ?? 64}</Button>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Nombre (opcional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Espada legendaria" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <span className="text-sm">Irrompible</span>
            <Switch checked={unbreakable} onCheckedChange={setUnbreakable} />
          </div>

          <div className="rounded-lg border">
            <button className="flex w-full items-center justify-between px-3 py-2 text-sm" onClick={() => setShowEnch((s) => !s)}>
              <span className="flex items-center gap-2"><Sparkles className="size-4 text-primary" />Encantamientos {Object.values(ench).filter(Boolean).length > 0 && <Badge className="h-4 px-1 text-[10px]">{Object.values(ench).filter(Boolean).length}</Badge>}</span>
              <span className="text-xs text-muted-foreground">{showEnch ? "ocultar" : "mostrar"}</span>
            </button>
            {showEnch && (
              <div className="space-y-2 border-t p-3">
                <Input value={enchQ} onChange={(e) => setEnchQ(e.target.value)} placeholder="Buscar encantamiento…" className="h-8 text-xs" />
                <div className="max-h-56 space-y-1 overflow-auto pr-1">
                  {enchList.map((e) => {
                    const lvl = ench[e.name] ?? 0;
                    return (
                      <div key={e.name} className={cn("flex items-center gap-2 rounded-md px-2 py-1 text-xs", lvl > 0 && "bg-primary/10")}>
                        <span className="min-w-0 flex-1 truncate">{e.displayName}<span className="ml-1 font-mono text-[10px] text-muted-foreground">max {e.maxLevel}</span></span>
                        <div className="flex items-center gap-1">
                          <Button size="icon-xs" variant="ghost" onClick={() => setEnch((s) => ({ ...s, [e.name]: Math.max(0, lvl - 1) }))} disabled={lvl === 0}>−</Button>
                          <span className="w-6 text-center font-mono">{lvl}</span>
                          <Button size="icon-xs" variant="ghost" onClick={() => setEnch((s) => ({ ...s, [e.name]: Math.min(255, lvl + 1) }))}>+</Button>
                          <Button size="icon-xs" variant="ghost" onClick={() => setEnch((s) => ({ ...s, [e.name]: e.maxLevel }))} title="Nivel maximo">max</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {Object.values(ench).some(Boolean) && <Button size="xs" variant="ghost" onClick={() => setEnch({})}><X />Quitar todos</Button>}
              </div>
            )}
          </div>

          <div className="rounded-lg bg-black/50 p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Comando</p>
            <code className="block break-all font-mono text-xs text-primary">{command ? `/${command}` : "—"}</code>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={give} disabled={!item || !online || running || !target.trim()}><Gift />Dar</Button>
            <Button variant="outline" size="icon" disabled={!command} onClick={() => { navigator.clipboard.writeText(`/${command}`); toast.success("Comando copiado"); }}><Copy /></Button>
          </div>
          {!online && <p className="text-xs text-muted-foreground">El servidor debe estar en linea para ejecutar. Puedes copiar el comando igualmente.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
