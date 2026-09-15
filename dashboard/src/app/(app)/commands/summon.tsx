"use client";
import { useMemo, useState } from "react";
import { Search, PawPrint, Copy, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TargetPicker } from "@/components/target-picker";
import { useCommands } from "@/components/command-runner";
import { label, type Catalog } from "@/hooks/use-catalog";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = { mob: "Mob", animal: "Animal", hostile: "Hostil", water_creature: "Acuatico", ambient: "Ambiente" };

export function SummonCommand({ catalog, loading, players }: { catalog: Catalog | null; loading: boolean; players: string[] }) {
  const { run, online, running } = useCommands();
  const [target, setTarget] = useState(players[0] ?? "@p");
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [name, setName] = useState("");
  const [baby, setBaby] = useState(false);
  const [lightning, setLightning] = useState(false);

  const entities = useMemo(() => {
    const all = catalog?.entities ?? [];
    const n = q.trim().toLowerCase();
    return (n ? all.filter((e) => e.name.includes(n) || e.displayName.toLowerCase().includes(n) || (e.es ?? "").toLowerCase().includes(n)) : all).sort((a, b) => label(a).localeCompare(label(b)));
  }, [catalog, q]);

  const nbt: string[] = [];
  if (name.trim()) nbt.push(`CustomName:"${name.trim().replace(/"/g, '\\"')}",CustomNameVisible:1b`);
  if (baby) nbt.push("Age:-24000");
  const id = entity ? `minecraft:${entity}` : "";
  // Se invoca en la posicion del objetivo usando execute at
  const command = entity ? `execute at ${target.trim()} run summon ${id} ~ ~ ~${nbt.length ? ` {${nbt.join(",")}}` : ""}` : "";

  const summon = async () => {
    if (!entity) return;
    for (let i = 0; i < Math.min(count, 50); i++) { const ok = await run(command); if (!ok) break; }
    if (lightning) await run(`execute at ${target.trim()} run summon minecraft:lightning_bolt ~ ~ ~`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PawPrint className="size-4 text-primary" />Criaturas</CardTitle>
          <CardDescription>{catalog ? `${catalog.entities.length} entidades invocables` : "Cargando…"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: zombie, villager, ender…" className="pl-8" />
          </div>
          {loading ? <Skeleton className="h-48" /> : (
            <div className="grid max-h-[46vh] gap-1.5 overflow-auto pr-1 sm:grid-cols-2 md:grid-cols-3">
              {entities.map((e) => (
                <button key={e.name} onClick={() => setEntity(e.name)}
                  className={cn("flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5",
                    entity === e.name && "border-primary bg-primary/10")}>
                  <span className={cn("size-2 shrink-0 rounded-full", e.type === "hostile" ? "bg-destructive" : e.type === "animal" ? "bg-primary" : "bg-chart-2")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{label(e)}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{e.es ? `${e.displayName} · ` : ""}{TYPE_LABEL[e.type] ?? e.type}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
        <CardHeader>
          <CardTitle>Invocar</CardTitle>
          <CardDescription>{entity ? <span className="font-mono">{id}</span> : "Selecciona una criatura"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">En la posicion de</Label>
            <TargetPicker value={target} onChange={setTarget} players={players} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Cantidad (max 50)</Label>
              <Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} className="font-mono" />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Nombre (opcional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bob" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="xs" variant={baby ? "default" : "outline"} onClick={() => setBaby((b) => !b)}>Bebe</Button>
            <Button size="xs" variant={lightning ? "default" : "outline"} onClick={() => setLightning((b) => !b)}><Zap />Con rayo</Button>
          </div>
          <div className="rounded-lg bg-black/50 p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Comando{count > 1 && ` (x${count})`}</p>
            <code className="block break-all font-mono text-xs text-primary">{command ? `/${command}` : "—"}</code>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={summon} disabled={!entity || !online || running || !target.trim()}><PawPrint />Invocar</Button>
            <Button variant="outline" size="icon" disabled={!command} onClick={() => { navigator.clipboard.writeText(`/${command}`); toast.success("Comando copiado"); }}><Copy /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
