"use client";
import { useState } from "react";
import { MapPin, Navigation, Users, ArrowRightLeft, Save, Trash2, Crosshair, Copy, Flame, Moon, Globe2, LocateFixed, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TargetPicker } from "@/components/target-picker";
import { useCommands } from "@/components/command-runner";
import { loadLS, saveLS } from "@/hooks/use-catalog";
import { apiFetch } from "@/lib/client";
import { cn } from "@/lib/utils";

type Dim = "minecraft:overworld" | "minecraft:the_nether" | "minecraft:the_end";
type Warp = { id: string; name: string; x: number; y: number; z: number; dim: Dim };
const KEY = "exaroton.warps";

const DIMS: { id: Dim; label: string; icon: React.ElementType }[] = [
  { id: "minecraft:overworld", label: "Overworld", icon: Globe2 },
  { id: "minecraft:the_nether", label: "Nether", icon: Flame },
  { id: "minecraft:the_end", label: "End", icon: Moon },
];
const dimLabel = (d: Dim) => DIMS.find((x) => x.id === d)?.label ?? d;

// Lee la posicion real de un jugador: ejecuta `data get` y busca la respuesta en el log del servidor
async function readPosition(run: (c: string) => Promise<boolean>, player: string): Promise<{ x: number; y: number; z: number; dim: Dim } | null> {
  const okPos = await run(`data get entity ${player} Pos`);
  if (!okPos) return null;
  await run(`data get entity ${player} Dimension`);
  await new Promise((r) => setTimeout(r, 1200));
  const { content } = await apiFetch<{ content: string }>("/api/server/logs");
  const lines = content.split("\n").reverse();
  const esc = player.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pos = lines.find((l) => new RegExp(`${esc} has the following entity data: \\[`).test(l))?.match(/\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/);
  const dim = lines.find((l) => new RegExp(`${esc} has the following entity data: "minecraft:`).test(l))?.match(/"(minecraft:[a-z_]+)"/);
  if (!pos) return null;
  return { x: Math.round(Number(pos[1]) * 10) / 10, y: Math.round(Number(pos[2]) * 10) / 10, z: Math.round(Number(pos[3]) * 10) / 10, dim: (dim?.[1] as Dim) ?? "minecraft:overworld" };
}

export function TeleportCommand({ players }: { players: string[] }) {
  const { run, online, running } = useCommands();
  const [who, setWho] = useState(players[0] ?? "@a");
  const [dest, setDest] = useState(players[1] ?? players[0] ?? "");
  const [x, setX] = useState(""); const [y, setY] = useState(""); const [z, setZ] = useState("");
  const [dim, setDim] = useState<Dim>("minecraft:overworld");
  const [warps, setWarps] = useState<Warp[]>(() => loadLS<Warp[]>(KEY, []));
  const [warpName, setWarpName] = useState("");
  const [reading, setReading] = useState(false);

  const persist = (w: Warp[]) => { setWarps(w); saveLS(KEY, w); };
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const coordsOk = [x, y, z].every((v) => v.trim() !== "" && !isNaN(Number(v)));
  const coordCmd = coordsOk ? `execute in ${dim} run tp ${who.trim()} ${num(x)} ${num(y)} ${num(z)}` : "";
  const busy = !online || running || reading;

  const tpToCoords = () => coordCmd && run(coordCmd);
  const tpToPlayer = () => dest.trim() && run(`tp ${who.trim()} ${dest.trim()}`);
  const bringAll = () => dest.trim() && run(`tp @a ${dest.trim()}`);
  const tpToWarp = (w: Warp, target = who) => run(`execute in ${w.dim} run tp ${target.trim()} ${w.x} ${w.y} ${w.z}`);

  const readInto = async () => {
    const p = who.trim();
    if (!p || p.startsWith("@")) return toast.error("Elige un jugador concreto (no un selector) para leer su posicion");
    setReading(true);
    try {
      const pos = await readPosition(run, p);
      if (!pos) return toast.error("No se encontro la posicion en el log", { description: "Prueba de nuevo en unos segundos." });
      setX(String(pos.x)); setY(String(pos.y)); setZ(String(pos.z)); setDim(pos.dim);
      toast.success(`${p} esta en ${pos.x}, ${pos.y}, ${pos.z} (${dimLabel(pos.dim)})`);
    } finally { setReading(false); }
  };

  const saveWarp = () => {
    if (!warpName.trim() || !coordsOk) return;
    persist([...warps, { id: crypto.randomUUID(), name: warpName.trim(), x: Number(x), y: Number(y), z: Number(z), dim }]);
    setWarpName(""); toast.success("Ubicacion guardada");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="flex flex-col gap-4 lg:col-span-3">
        {/* Jugador -> jugador */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ArrowRightLeft className="size-4 text-primary" />Entre jugadores</CardTitle>
            <CardDescription>Lleva a un jugador (o a todos) hasta otro jugador.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Quien se mueve</Label>
                <TargetPicker value={who} onChange={setWho} players={players} />
              </div>
              <div>
                <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Hacia (jugador destino)</Label>
                <TargetPicker value={dest} onChange={setDest} players={players} allowSelectors={false} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={tpToPlayer} disabled={busy || !who.trim() || !dest.trim()}><Navigation />Teletransportar</Button>
              <Button variant="secondary" onClick={bringAll} disabled={busy || !dest.trim()}><Users />Traer a todos hacia {dest || "…"}</Button>
            </div>
          </CardContent>
        </Card>

        {/* Coordenadas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Crosshair className="size-4 text-primary" />A coordenadas</CardTitle>
            <CardDescription>Mueve a <b className="font-mono text-foreground">{who || "—"}</b> a un punto exacto. Puedes leer la posicion actual de un jugador para partir de ahi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              {[["X", x, setX], ["Y", y, setY], ["Z", z, setZ]].map(([l, v, set]) => (
                <div key={l as string} className="w-28">
                  <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">{l as string}</Label>
                  <Input type="number" step="0.5" value={v as string} onChange={(e) => (set as (s: string) => void)(e.target.value)} className="font-mono" placeholder="0" />
                </div>
              ))}
              <div className="flex gap-1">
                {DIMS.map((d) => <Button key={d.id} size="sm" variant={dim === d.id ? "default" : "outline"} onClick={() => setDim(d.id)}><d.icon />{d.label}</Button>)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={tpToCoords} disabled={busy || !coordsOk || !who.trim()}><MapPin />Ir a coordenadas</Button>
              <Button variant="outline" onClick={readInto} disabled={busy || !who.trim()}>{reading ? <Loader2 className="animate-spin" /> : <LocateFixed />}Leer posicion de {who || "…"}</Button>
              <Button variant="ghost" size="icon" disabled={!coordCmd} onClick={() => { navigator.clipboard.writeText(`/${coordCmd}`); toast.success("Copiado"); }}><Copy /></Button>
            </div>
            {coordCmd && <code className="block break-all rounded-lg bg-black/50 p-3 font-mono text-xs text-primary">/{coordCmd}</code>}
            <div className="flex gap-2 border-t pt-3">
              <Input value={warpName} onChange={(e) => setWarpName(e.target.value)} placeholder="Guardar estas coordenadas como… (ej. Base)" onKeyDown={(e) => e.key === "Enter" && saveWarp()} />
              <Button variant="secondary" onClick={saveWarp} disabled={!warpName.trim() || !coordsOk}><Save />Guardar</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warps */}
      <Card className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="size-4 text-primary" />Ubicaciones guardadas</CardTitle>
          <CardDescription>Warps rapidos para <b className="font-mono text-foreground">{who || "—"}</b>. Se guardan en este navegador.</CardDescription>
        </CardHeader>
        <CardContent>
          {warps.length === 0 ? (
            <div className="grid place-items-center rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              Sin ubicaciones.<br />Lee la posicion de un jugador y guardala con un nombre.
            </div>
          ) : (
            <ul className="space-y-2">
              {warps.map((w) => {
                const D = DIMS.find((d) => d.id === w.dim)!;
                return (
                  <li key={w.id} className="group flex items-center gap-2 rounded-lg border bg-card/60 px-3 py-2">
                    <D.icon className={cn("size-4 shrink-0", w.dim === "minecraft:the_nether" ? "text-destructive" : w.dim === "minecraft:the_end" ? "text-chart-5" : "text-primary")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{w.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{w.x}, {w.y}, {w.z} <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px]">{D.label}</Badge></p>
                    </div>
                    <Button size="sm" onClick={() => tpToWarp(w)} disabled={busy || !who.trim()} title={`tp ${who} aqui`}><Navigation />Ir</Button>
                    <Button size="sm" variant="outline" onClick={() => tpToWarp(w, "@a")} disabled={busy} title="Traer a todos aqui"><Users /></Button>
                    <Button size="icon-sm" variant="ghost" className="text-destructive opacity-50 group-hover:opacity-100" onClick={() => persist(warps.filter((x) => x.id !== w.id))}><Trash2 /></Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
