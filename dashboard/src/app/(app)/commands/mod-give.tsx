"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Gift, Copy, Package, Puzzle, ExternalLink, BookOpen, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TargetPicker } from "@/components/target-picker";
import { useCommands } from "@/components/command-runner";
import { cn } from "@/lib/utils";

type ModItem = { id: string; en: string; es?: string; icon?: string };
type Mod = { id: string; name: string; title?: string; version: string; description: string; homepage: string | null; modrinth?: string; wiki?: string | null; icon_url?: string | null; items: ModItem[] };
type Index = { generated: string; mods: Mod[] };

const PAGE = 150;
const itemLabel = (i: ModItem) => i.es ?? i.en;
const modLabel = (m: Mod) => m.title ?? m.name;

function Icon({ src, className }: { src?: string; className?: string }) {
  if (!src) return <span className={cn("grid shrink-0 place-items-center rounded bg-muted text-[9px] text-muted-foreground", className)}>?</span>;
  // Las texturas animadas son tiras verticales: se muestra solo el primer fotograma
  return <span className={cn("shrink-0 bg-no-repeat [image-rendering:pixelated]", className)} style={{ backgroundImage: `url(/mod-items/${src})`, backgroundSize: "100% auto", backgroundPosition: "top" }} />;
}

// Give de items de mods: catalogo generado desde los jars del servidor (scripts/mod-items.mjs)
export function ModGiveCommand({ players }: { players: string[] }) {
  const { run, online, running } = useCommands();
  const [data, setData] = useState<Index | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mod, setMod] = useState<string>("all");
  const [modQ, setModQ] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [item, setItem] = useState<(ModItem & { mod: Mod }) | null>(null);
  const [target, setTarget] = useState("@p");
  const [amount, setAmount] = useState(1);

  useEffect(() => {
    fetch("/mod-items/index.json").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).then(setData).catch((e) => setError((e as Error).message));
  }, []);

  const mods = useMemo(() => {
    const s = modQ.trim().toLowerCase();
    return (data?.mods ?? []).filter((m) => !s || modLabel(m).toLowerCase().includes(s) || m.id.includes(s));
  }, [data, modQ]);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const src = (data?.mods ?? []).filter((m) => mod === "all" || m.id === mod);
    const out: (ModItem & { mod: Mod })[] = [];
    for (const m of src) for (const i of m.items) if (!s || i.id.includes(s) || i.en.toLowerCase().includes(s) || (i.es ?? "").toLowerCase().includes(s)) out.push({ ...i, mod: m });
    return out;
  }, [data, mod, q]);

  const current = data?.mods.find((m) => m.id === mod) ?? null;
  const total = data?.mods.reduce((n, m) => n + m.items.length, 0) ?? 0;
  const command = item ? `give ${target.trim() || "@p"} ${item.id} ${amount}` : "";

  const give = async () => {
    if (!command) return;
    const ok = await run(command);
    if (ok) toast.success(`${itemLabel(item!)} x${amount} → ${target}`);
  };

  if (error) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No se pudo cargar el catalogo de mods ({error}). Generalo con <code>node scripts/mod-items.mjs &lt;carpeta mods&gt;</code>.</CardContent></Card>;

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Mods */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Puzzle className="size-4 text-primary" />Mods</CardTitle>
          <CardDescription>{data ? `${data.mods.length} mods con items · ${total.toLocaleString()} items` : "Cargando…"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input value={modQ} onChange={(e) => setModQ(e.target.value)} placeholder="Filtrar mods…" className="h-8 text-xs" />
          <div className="max-h-[60vh] space-y-0.5 overflow-auto pr-1">
            <button onClick={() => { setMod("all"); setLimit(PAGE); }} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", mod === "all" && "bg-primary/10 text-primary")}>
              <Package className="size-4" /><span className="flex-1">Todos</span><span className="text-[10px] text-muted-foreground">{total}</span>
            </button>
            {!data && [...Array(10)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            {mods.map((m) => (
              <button key={m.id} onClick={() => { setMod(m.id); setLimit(PAGE); }} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", mod === m.id && "bg-primary/10 text-primary")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.icon_url ? <img src={m.icon_url} alt="" className="size-5 shrink-0 rounded" loading="lazy" /> : <Puzzle className="size-4 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate">{modLabel(m)}</span>
                <span className="text-[10px] text-muted-foreground">{m.items.length}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="lg:col-span-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {current?.icon_url && <img src={current.icon_url} alt="" className="size-5 rounded" />}
            {current ? modLabel(current) : "Todos los mods"}
          </CardTitle>
          <CardDescription className="space-y-1">
            {current ? (
              <>
                {current.description && <span className="block">{current.description}</span>}
                <span className="flex flex-wrap gap-3 text-xs">
                  {current.modrinth && <a href={current.modrinth} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="size-3" />Modrinth</a>}
                  {current.wiki && <a href={current.wiki} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><BookOpen className="size-3" />Wiki</a>}
                  {current.homepage && current.homepage !== current.modrinth && <a href={current.homepage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="size-3" />Pagina</a>}
                  <span className="font-mono text-muted-foreground">{current.id} {current.version}</span>
                </span>
              </>
            ) : "Busca por nombre (español o ingles) o por ID en todos los mods a la vez."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Buscar: rubi, cooking pot, enderite, wizard…" className="pl-8" />
          </div>
          <p className="text-[11px] text-muted-foreground">{items.length.toLocaleString()} items</p>
          <div className="grid max-h-[56vh] gap-1.5 overflow-auto pr-1 sm:grid-cols-2">
            {items.slice(0, limit).map((i) => (
              <button key={i.id} onClick={() => setItem(i)}
                className={cn("flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5", item?.id === i.id && "border-primary bg-primary/10")}>
                <Icon src={i.icon} className="size-6" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{itemLabel(i)}</span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">{i.es ? `${i.en} · ` : ""}{i.id}</span>
                </span>
              </button>
            ))}
            {data && items.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Sin resultados.</p>}
          </div>
          {items.length > limit && <Button variant="ghost" size="sm" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>Mostrar mas ({items.length - limit} restantes)</Button>}
        </CardContent>
      </Card>

      {/* Dar */}
      <Card className="lg:col-span-3 lg:sticky lg:top-20 lg:self-start">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">{item ? <Icon src={item.icon} className="size-6" /> : <Gift className="size-4 text-primary" />}<span className="truncate">{item ? itemLabel(item) : "Dar item de mod"}</span></CardTitle>
          <CardDescription>{item ? <><span className="font-mono">{item.id}</span><span className="block">de {modLabel(item.mod)}</span></> : "Elige un item de la lista"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Para</Label>
            <TargetPicker value={target} onChange={setTarget} players={players} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Cantidad</Label>
            <div className="flex gap-1">
              <Button size="icon" variant="outline" onClick={() => setAmount((a) => Math.max(1, a - 1))}><Minus /></Button>
              <Input type="number" min={1} max={6400} value={amount} onChange={(e) => setAmount(Math.max(1, Math.min(6400, Number(e.target.value) || 1)))} className="text-center font-mono" />
              <Button size="icon" variant="outline" onClick={() => setAmount((a) => Math.min(6400, a + 1))}><Plus /></Button>
            </div>
            <div className="mt-1.5 flex gap-1">{[1, 16, 32, 64].map((n) => <Button key={n} size="xs" variant={amount === n ? "default" : "secondary"} onClick={() => setAmount(n)}>{n}</Button>)}</div>
          </div>
          {command && <pre className="overflow-x-auto rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs">/{command}</pre>}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={give} disabled={!item || !online || running}><Gift />Dar</Button>
            <Button variant="outline" size="icon" disabled={!command} title="Copiar comando" onClick={() => { navigator.clipboard.writeText("/" + command); toast.success("Comando copiado"); }}><Copy /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
