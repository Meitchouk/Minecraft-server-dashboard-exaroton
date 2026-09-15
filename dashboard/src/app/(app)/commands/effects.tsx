"use client";
import { useMemo, useState } from "react";
import { FlaskConical, Eraser, Search, Copy, Ghost, Skull } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { TargetPicker } from "@/components/target-picker";
import { useCommands } from "@/components/command-runner";
import { label, type Catalog } from "@/hooks/use-catalog";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "God mode (5 min)", cmds: ["effect give {t} minecraft:resistance 300 4 true", "effect give {t} minecraft:regeneration 300 4 true", "effect give {t} minecraft:fire_resistance 300 0 true", "effect give {t} minecraft:saturation 300 0 true"] },
  { label: "Vision nocturna (10 min)", cmds: ["effect give {t} minecraft:night_vision 600 0 true"] },
  { label: "Velocidad II (5 min)", cmds: ["effect give {t} minecraft:speed 300 1 true"] },
  { label: "Prisa II (10 min)", cmds: ["effect give {t} minecraft:haste 600 1 true"] },
  { label: "Respirar bajo agua (10 min)", cmds: ["effect give {t} minecraft:water_breathing 600 0 true"] },
  { label: "Invisible (5 min)", cmds: ["effect give {t} minecraft:invisibility 300 0 true"] },
];

export function EffectsCommand({ catalog, loading, players }: { catalog: Catalog | null; loading: boolean; players: string[] }) {
  const { run, online, running } = useCommands();
  const [target, setTarget] = useState(players[0] ?? "@a");
  const [q, setQ] = useState("");
  const [effect, setEffect] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(60);
  const [infinite, setInfinite] = useState(false);
  const [amp, setAmp] = useState(0);
  const [hide, setHide] = useState(true);

  const effects = useMemo(() => {
    const all = catalog?.effects ?? [];
    const n = q.trim().toLowerCase();
    return (n ? all.filter((e) => e.name.toLowerCase().includes(n) || e.displayName.toLowerCase().includes(n) || (e.es ?? "").toLowerCase().includes(n)) : all)
      .sort((a, b) => (a.type === b.type ? label(a).localeCompare(label(b)) : a.type === "good" ? -1 : 1));
  }, [catalog, q]);

  const id = effect ? `minecraft:${effect.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()}` : "";
  const command = effect ? `effect give ${target.trim()} ${id} ${infinite ? "infinite" : seconds} ${amp} ${hide}` : "";

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FlaskConical className="size-4 text-primary" />Efectos</CardTitle>
          <CardDescription>{catalog ? `${catalog.effects.length} efectos disponibles` : "Cargando…"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar efecto…" className="pl-8" />
          </div>
          {loading ? <Skeleton className="h-48" /> : (
            <div className="grid max-h-[40vh] gap-1.5 overflow-auto pr-1 sm:grid-cols-2 md:grid-cols-3">
              {effects.map((e) => (
                <button key={e.name} onClick={() => setEffect(e.name)}
                  className={cn("flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5",
                    effect === e.name && "border-primary bg-primary/10")}>
                  {e.type === "good" ? <Ghost className="size-4 text-primary" /> : <Skull className="size-4 text-destructive" />}
                  <span className="min-w-0 flex-1"><span className="block truncate">{label(e)}</span>{e.es && <span className="block truncate text-[10px] text-muted-foreground">{e.displayName}</span>}</span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Presets</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <Button key={p.label} size="sm" variant="secondary" disabled={!online || running || !target.trim()}
                  onClick={async () => { for (const c of p.cmds) await run(c.replaceAll("{t}", target.trim())); }}>{p.label}</Button>
              ))}
              <Button size="sm" variant="destructive" disabled={!online || running || !target.trim()} onClick={() => run(`effect clear ${target.trim()}`)}><Eraser />Quitar todos</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
        <CardHeader>
          <CardTitle>Aplicar efecto</CardTitle>
          <CardDescription>{effect ? <span className="font-mono">{id}</span> : "Selecciona un efecto"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Objetivo</Label>
            <TargetPicker value={target} onChange={setTarget} players={players} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Duracion</Label>
              <span className="flex items-center gap-2 text-xs">Infinita <Switch checked={infinite} onCheckedChange={setInfinite} /></span>
            </div>
            <div className={cn("flex items-center gap-3", infinite && "opacity-40 pointer-events-none")}>
              <Slider min={1} max={3600} step={1} value={[seconds]} onValueChange={(v) => setSeconds(Array.isArray(v) ? v[0] : (v as number))} className="flex-1" />
              <Input type="number" min={1} value={seconds} onChange={(e) => setSeconds(Math.max(1, Number(e.target.value) || 1))} className="w-20 font-mono" />
              <span className="text-xs text-muted-foreground">s</span>
            </div>
          </div>
          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Nivel (amplificador {amp} = nivel {amp + 1})</Label>
            <div className="flex flex-wrap gap-1.5">
              {[0, 1, 2, 3, 4, 9, 49, 254].map((a) => <Button key={a} size="xs" variant={amp === a ? "default" : "outline"} onClick={() => setAmp(a)}>{a + 1 <= 10 ? `Nivel ${a + 1}` : a === 254 ? "MAX" : `x${a + 1}`}</Button>)}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <span className="text-sm">Ocultar particulas</span>
            <Switch checked={hide} onCheckedChange={setHide} />
          </div>
          <div className="rounded-lg bg-black/50 p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Comando</p>
            <code className="block break-all font-mono text-xs text-primary">{command ? `/${command}` : "—"}</code>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => run(command)} disabled={!effect || !online || running || !target.trim()}><FlaskConical />Aplicar</Button>
            <Button variant="outline" size="icon" disabled={!command} onClick={() => { navigator.clipboard.writeText(`/${command}`); toast.success("Comando copiado"); }}><Copy /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
