"use client";
import { useMemo, useState } from "react";
import { Search, Gift, Sparkles, Plus, X, Copy, Clock, Package, Wand2, Shield, Swords, Pickaxe, Apple, FlaskRound, Gem, Boxes, Egg, Shapes, LayoutGrid, Backpack, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TargetPicker } from "@/components/target-picker";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCommands } from "@/components/command-runner";
import { CATEGORY_META, GEAR_ENCHANTS, KITS, gearType, label, loadLS, saveLS, versionAtLeast, type Catalog, type CatalogItem, type ItemCategory } from "@/hooks/use-catalog";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";

const RECENT_KEY = "exaroton.give.recent";
const PAGE = 120;

const CAT_ICON: Record<ItemCategory | "all", React.ElementType> = { all: LayoutGrid, weapon: Swords, armor: Shield, tool: Pickaxe, food: Apple, potion: FlaskRound, material: Gem, block: Boxes, egg: Egg, other: Shapes };
const POTION_ITEMS = new Set(["potion", "splash_potion", "lingering_potion", "tipped_arrow"]);
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

type GiveOpts = { item: string; amount: number; target: string; ench: Record<string, number>; name?: string; unbreakable?: boolean; potion?: string | null; version: string };

// Construye el /give segun la version: componentes (1.20.5+) o NBT (anterior)
export function buildGive(o: GiveOpts) {
  const id = o.item.includes(":") ? o.item : `minecraft:${o.item}`;
  const enchEntries = Object.entries(o.ench).filter(([, l]) => l > 0);
  const name = o.name?.trim();
  if (versionAtLeast(o.version, "1.20.5")) {
    const plainName = versionAtLeast(o.version, "1.21.5");
    const parts: string[] = [];
    if (enchEntries.length) parts.push(`enchantments={${enchEntries.map(([k, l]) => `"minecraft:${k}":${l}`).join(",")}}`);
    if (o.potion) parts.push(`potion_contents="minecraft:${o.potion}"`);
    if (name) parts.push(plainName ? `custom_name="${esc(name)}"` : `custom_name='{"text":"${esc(name)}"}'`);
    if (o.unbreakable) parts.push("unbreakable={}");
    return `give ${o.target.trim()} ${id}${parts.length ? `[${parts.join(",")}]` : ""} ${o.amount}`;
  }
  const nbt: string[] = [];
  if (enchEntries.length) nbt.push(`Enchantments:[${enchEntries.map(([k, l]) => `{id:"minecraft:${k}",lvl:${l}s}`).join(",")}]`);
  if (o.potion) nbt.push(`Potion:"minecraft:${o.potion}"`);
  if (name) nbt.push(`display:{Name:'{"text":"${esc(name)}"}'}`);
  if (o.unbreakable) nbt.push("Unbreakable:1b");
  return `give ${o.target.trim()} ${id}${nbt.length ? `{${nbt.join(",")}}` : ""} ${o.amount}`;
}

// Encantamientos recomendados (nivel maximo) para un item, limitados a los que existen en el catalogo
export function recommendedFor(item: string, catalog: Catalog | null): Record<string, number> {
  const t = gearType(item);
  if (!t || !catalog) return {};
  const max = new Map(catalog.enchantments.map((e) => [e.name, e.maxLevel]));
  return Object.fromEntries(GEAR_ENCHANTS[t].recommended.filter((e) => max.has(e)).map((e) => [e, max.get(e)!]));
}

export function GiveCommand({ catalog, loading, players }: { catalog: Catalog | null; loading: boolean; players: string[] }) {
  const { run, online, running } = useCommands();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ItemCategory | "all">("all");
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [amount, setAmount] = useState(1);
  const [target, setTarget] = useState(players[0] ?? "@p");
  const [ench, setEnch] = useState<Record<string, number>>({});
  const [potion, setPotion] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [unbreakable, setUnbreakable] = useState(false);
  const [enchQ, setEnchQ] = useState("");
  const [showAllEnch, setShowAllEnch] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [recent, setRecent] = useState<string[]>(() => loadLS(RECENT_KEY, []));
  const customStore = useStore<{ name: string }>("custom_items");
  const custom = useMemo(() => customStore.items.map((c) => c.name), [customStore.items]);
  const [customInput, setCustomInput] = useState("");
  const [kitsUnlocked, setKitsUnlocked] = useState(false);

  const version = catalog?.version ?? "1.21";
  const type = item ? gearType(item.name) : null;
  const isPotion = !!item && POTION_ITEMS.has(item.name);

  const items = useMemo<CatalogItem[]>(() => {
    const base = catalog?.items ?? [];
    const customItems: CatalogItem[] = custom.map((c) => ({ name: c, displayName: c, stackSize: 64, es: null, category: "other" }));
    const all = [...customItems, ...base];
    const needle = q.trim().toLowerCase().replace(/^minecraft:/, "");
    return all.filter((i) => (cat === "all" || i.category === cat) &&
      (!needle || i.name.includes(needle) || i.displayName.toLowerCase().includes(needle) || (i.es ?? "").toLowerCase().includes(needle)));
  }, [catalog, q, custom, cat]);

  const counts = useMemo(() => {
    const c: Partial<Record<ItemCategory, number>> = {};
    for (const i of catalog?.items ?? []) c[i.category] = (c[i.category] ?? 0) + 1;
    return c;
  }, [catalog]);

  // Encantamientos: compatibles con el item primero, el resto bajo "ver todos"
  const enchGroups = useMemo(() => {
    const all = catalog?.enchantments ?? [];
    const n = enchQ.trim().toLowerCase();
    const match = (e: Catalog["enchantments"][number]) => !n || e.name.includes(n) || e.displayName.toLowerCase().includes(n) || (e.es ?? "").toLowerCase().includes(n);
    const applicable = new Set(type ? GEAR_ENCHANTS[type].applicable : []);
    const rec = new Set(type ? GEAR_ENCHANTS[type].recommended : []);
    return {
      compatible: all.filter((e) => applicable.has(e.name) && match(e)).map((e) => ({ ...e, rec: rec.has(e.name) }))
        .sort((a, b) => Number(b.rec) - Number(a.rec) || label(a).localeCompare(label(b))),
      others: all.filter((e) => !applicable.has(e.name) && match(e)).map((e) => ({ ...e, rec: false })).sort((a, b) => label(a).localeCompare(label(b))),
    };
  }, [catalog, enchQ, type]);

  const command = item ? buildGive({ item: item.name, amount, target, ench, name, unbreakable, potion: isPotion ? potion : null, version }) : "";
  const enchCount = Object.values(ench).filter(Boolean).length;

  const pick = (i: CatalogItem) => { setItem(i); setEnch({}); setAmount(1); setPotion(POTION_ITEMS.has(i.name) ? "swiftness" : null); setShowAllEnch(false); };
  const applyRecommended = () => { const r = recommendedFor(item!.name, catalog); setEnch(r); toast.success(`${Object.keys(r).length} encantamientos recomendados aplicados`); };

  const give = async () => {
    if (!item) return;
    const ok = await run(command);
    if (ok) { const r = [item.name, ...recent.filter((x) => x !== item.name)].slice(0, 12); setRecent(r); saveLS(RECENT_KEY, r); }
  };

  const giveKit = async (kit: (typeof KITS)[number], enchanted: boolean) => {
    if (!target.trim()) return toast.error("Elige un objetivo");
    const id = toast.loading(`Dando ${kit.label}…`);
    for (const it of kit.items) {
      const isStack = ["golden_apple", "arrow"].includes(it);
      const ok = await run(buildGive({ item: it, amount: isStack ? (it === "arrow" ? 64 : 8) : 1, target, ench: enchanted ? recommendedFor(it, catalog) : {}, version }));
      if (!ok) { toast.error("Kit interrumpido", { id }); return; }
    }
    toast.success(`${kit.label} entregado a ${target}`, { id });
  };

  const addCustom = () => {
    const v = customInput.trim().toLowerCase();
    if (!v) return;
    if (custom.includes(v)) { setCustomInput(""); pick({ name: v, displayName: v, stackSize: 64, es: null, category: "other" }); return; }
    customStore.put({ id: v.replace(/[^A-Za-z0-9_.:-]/g, "_"), name: v }).then(() => {
      setCustomInput("");
      pick({ name: v, displayName: v, stackSize: 64, es: null, category: "other" });
      toast.success(`Item personalizado agregado: ${v}`);
    }).catch((e) => toast.error((e as Error).message));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Kits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Backpack className="size-4 text-primary" />Kits rapidos</CardTitle>
          <CardDescription>Sets completos en un clic. Se entregan a <b className="font-mono text-foreground">{target || "—"}</b> (cambia el objetivo abajo). Bloqueados por seguridad: activa el candado y confirma cada entrega.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={cn("flex items-center justify-between rounded-lg border px-3 py-2", kitsUnlocked ? "border-chart-3/40 bg-chart-3/10" : "bg-muted/30")}>
            <span className="flex items-center gap-2 text-sm">{kitsUnlocked ? <Unlock className="size-4 text-chart-3" /> : <Lock className="size-4 text-muted-foreground" />}{kitsUnlocked ? "Kits desbloqueados" : "Kits bloqueados"}</span>
            <Switch checked={kitsUnlocked} onCheckedChange={setKitsUnlocked} />
          </div>
          <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-4 transition-opacity", !kitsUnlocked && "opacity-50")}>
            {KITS.map((k) => (
              <div key={k.id} className="flex flex-col gap-2 rounded-lg border bg-card/60 p-3">
                <p className="text-sm font-medium leading-tight">{k.label}</p>
                <p className="truncate text-[11px] text-muted-foreground" title={k.items.join(", ")}>{k.items.length} objetos</p>
                <div className="mt-auto flex gap-1.5">
                  <KitConfirm kit={k} enchanted={false} target={target} disabled={!online || running || !kitsUnlocked} onConfirm={() => giveKit(k, false)} />
                  <KitConfirm kit={k} enchanted target={target} disabled={!online || running || !kitsUnlocked} onConfirm={() => giveKit(k, true)} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Item browser */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Package className="size-4 text-primary" />Items</CardTitle>
            <CardDescription>
              {loading ? "Cargando catalogo…" : catalog ? <>{catalog.items.length} items · version <b>{catalog.version}</b>{catalog.requested && catalog.requested !== catalog.version && <> (servidor {catalog.requested})</>} · nombres en {catalog.lang === "en" ? "ingles" : "espanol"}</> : "Sin catalogo"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {CATEGORY_META.map((c) => {
                const Icon = CAT_ICON[c.id];
                const n = c.id === "all" ? catalog?.items.length : counts[c.id];
                return (
                  <Button key={c.id} size="xs" variant={cat === c.id ? "default" : "secondary"} onClick={() => { setCat(c.id); setLimit(PAGE); }}>
                    <Icon />{c.label}{n ? <span className="ml-0.5 opacity-60">{n}</span> : null}
                  </Button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Buscar: espada, diamond_sword, Elytra…" className="pl-8" />
            </div>

            {recent.length > 0 && !q && cat === "all" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                {recent.map((r) => {
                  const it = (catalog?.items ?? []).find((i) => i.name === r) ?? { name: r, displayName: r, stackSize: 64, es: null, category: "other" as const };
                  return <Button key={r} size="xs" variant={item?.name === r ? "default" : "secondary"} onClick={() => pick(it)}>{label(it)}</Button>;
                })}
              </div>
            )}

            {loading ? <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">{[...Array(12)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div> : (
              <>
                <div className="grid max-h-[44vh] gap-1.5 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                  {items.slice(0, limit).map((i) => (
                    <button key={i.name} onClick={() => pick(i)}
                      className={cn("flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5",
                        item?.name === i.name && "border-primary bg-primary/10")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://mc.nerothe.com/img/${version.startsWith("1.") ? version : "1.21.4"}/minecraft_${i.name}.png`} alt="" width={20} height={20} loading="lazy" className="size-5 shrink-0 [image-rendering:pixelated]"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{label(i)}</span>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">{i.es ? `${i.displayName} · ` : ""}{i.name}</span>
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
              <p className="text-xs text-muted-foreground">Mods en /mods: {catalog.mods.slice(0, 8).map((m) => m.replace(/\.jar$/, "")).join(", ")}{catalog.mods.length > 8 && ` y ${catalog.mods.length - 8} mas`}. Sus items no estan en el catalogo vanilla; agregalos por ID.</p>
            )}
          </CardContent>
        </Card>

        {/* Builder */}
        <Card className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gift className="size-4 text-primary" />{item ? label(item) : "Dar item"}</CardTitle>
            <CardDescription>{item ? <span className="font-mono">{item.name.includes(":") ? item.name : `minecraft:${item.name}`}</span> : "Selecciona un item de la lista"}</CardDescription>
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

            {isPotion && (
              <div>
                <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Tipo de pocion</Label>
                <div className="flex max-h-40 flex-wrap gap-1 overflow-auto rounded-lg border p-2">
                  {(catalog?.potions ?? []).map((p) => (
                    <Button key={p.name} size="xs" variant={potion === p.name ? "default" : "outline"} onClick={() => setPotion(p.name)} title={p.name}>
                      {p.es ?? p.name}{/^strong_/.test(p.name) ? " II" : /^long_/.test(p.name) ? " +" : ""}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {type && (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-sm">Irrompible</span>
                <Switch checked={unbreakable} onCheckedChange={setUnbreakable} />
              </div>
            )}

            {/* Encantamientos */}
            <div className="rounded-lg border">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="flex items-center gap-2 text-sm"><Sparkles className="size-4 text-primary" />Encantamientos {enchCount > 0 && <Badge className="h-4 px-1 text-[10px]">{enchCount}</Badge>}</span>
                <div className="flex gap-1">
                  {type && <Button size="xs" onClick={applyRecommended}><Wand2 />Recomendados</Button>}
                  {enchCount > 0 && <Button size="xs" variant="ghost" onClick={() => setEnch({})}><X /></Button>}
                </div>
              </div>
              {!item ? null : (
                <div className="space-y-2 border-t p-3">
                  {!type && <p className="text-xs text-muted-foreground">Este item no suele encantarse; aun asi puedes forzar cualquier encantamiento.</p>}
                  <Input value={enchQ} onChange={(e) => setEnchQ(e.target.value)} placeholder="Buscar encantamiento…" className="h-8 text-xs" />
                  <div className="max-h-64 space-y-1 overflow-auto pr-1">
                    {type && enchGroups.compatible.length > 0 && (
                      <>
                        <p className="px-2 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Compatibles con {label(item)}</p>
                        {enchGroups.compatible.map((e) => <EnchRow key={e.name} e={e} lvl={ench[e.name] ?? 0} set={(v) => setEnch((s) => ({ ...s, [e.name]: v }))} />)}
                      </>
                    )}
                    {(type ? showAllEnch || enchQ : true) ? (
                      <>
                        {type && <p className="px-2 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Otros (no aplican normalmente)</p>}
                        {enchGroups.others.map((e) => <EnchRow key={e.name} e={e} lvl={ench[e.name] ?? 0} set={(v) => setEnch((s) => ({ ...s, [e.name]: v }))} />)}
                      </>
                    ) : (
                      <Button size="xs" variant="ghost" className="w-full" onClick={() => setShowAllEnch(true)}>Ver todos los encantamientos ({enchGroups.others.length})</Button>
                    )}
                  </div>
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
    </div>
  );
}

type EnchEntry = Catalog["enchantments"][number] & { rec: boolean };

function EnchRow({ e, lvl, set }: { e: EnchEntry; lvl: number; set: (v: number) => void }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-md px-2 py-1 text-xs", lvl > 0 && "bg-primary/10")}>
      <span className="min-w-0 flex-1 truncate">
        {label(e)}
        {e.rec && <Badge variant="outline" className="ml-1.5 h-4 border-primary/40 px-1 text-[9px] text-primary">rec.</Badge>}
        <span className="ml-1 font-mono text-[10px] text-muted-foreground">max {e.maxLevel}</span>
      </span>
      <div className="flex items-center gap-0.5">
        <Button size="icon-xs" variant="ghost" onClick={() => set(Math.max(0, lvl - 1))} disabled={lvl === 0}>−</Button>
        <span className="w-6 text-center font-mono">{lvl}</span>
        <Button size="icon-xs" variant="ghost" onClick={() => set(Math.min(255, lvl + 1))}>+</Button>
        <Button size="xs" variant="ghost" className="px-1.5" onClick={() => set(lvl === e.maxLevel ? 0 : e.maxLevel)}>max</Button>
      </div>
    </div>
  );
}

function KitConfirm({ kit, enchanted, target, disabled, onConfirm }: { kit: (typeof KITS)[number]; enchanted: boolean; target: string; disabled: boolean; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="xs" variant={enchanted ? "default" : "outline"} className="flex-1" disabled={disabled} />}>
        {enchanted && <Wand2 />}{enchanted ? "Encantado" : "Normal"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dar {kit.label}{enchanted ? " encantado" : ""}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se entregara a <b className="font-mono">{target}</b>: {kit.items.join(", ")}.{enchanted ? " Todo con encantamientos recomendados al nivel maximo." : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Si, entregar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
