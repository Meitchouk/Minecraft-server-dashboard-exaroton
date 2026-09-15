"use client";
import { useState } from "react";
import { Gavel, Trophy, Skull, Flame, EyeOff, Snail, Frown, Utensils, ArrowUp, Lock, Ban, UserX, Eraser, ShieldMinus, Ghost, Mountain, Sparkles, Gem, Apple, Heart, Zap, PartyPopper, Megaphone, ShieldPlus, Coins, Rocket, ScrollText, AlertTriangle, Anchor } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TargetPicker } from "@/components/target-picker";
import { CommandProvider, useCommands } from "@/components/command-runner";
import { useServer } from "@/hooks/use-server";
import { cn } from "@/lib/utils";

// {t} = objetivo, {m} = motivo/mensaje escrito por el admin
type Action = { label: string; desc: string; icon: React.ElementType; cmds: string[]; danger?: boolean; confirm?: boolean; needsMsg?: boolean };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const tell = (t: string, text: string, color: string) => `tellraw ${t} {"text":"${esc(text)}","color":"${color}","bold":true}`;
const title = (t: string, text: string, color: string, sub?: string) => [
  `title ${t} times 10 70 20`,
  ...(sub ? [`title ${t} subtitle {"text":"${esc(sub)}","color":"gray"}`] : []),
  `title ${t} title {"text":"${esc(text)}","color":"${color}","bold":true}`,
];

const PUNISH: Action[] = [
  { label: "Advertencia", desc: "Titulo rojo en pantalla + mensaje en chat con el motivo", icon: AlertTriangle, needsMsg: true, cmds: [...title("{t}", "ADVERTENCIA", "red", "{m}"), tell("{t}", "Advertencia del administrador: {m}", "red")] },
  { label: "Rayo divino", desc: "Le cae un rayo encima (dano + fuego)", icon: Flame, cmds: ["execute at {t} run summon minecraft:lightning_bolt ~ ~ ~"] },
  { label: "Envenenar", desc: "Veneno II durante 20 s", icon: Skull, cmds: ["effect give {t} minecraft:poison 20 1 true"] },
  { label: "Ceguera", desc: "Ceguera + oscuridad 30 s", icon: EyeOff, cmds: ["effect give {t} minecraft:blindness 30 0 true", "effect give {t} minecraft:darkness 30 0 true"] },
  { label: "Lentitud extrema", desc: "Lentitud V + fatiga de minero 60 s", icon: Snail, cmds: ["effect give {t} minecraft:slowness 60 4 true", "effect give {t} minecraft:mining_fatigue 60 2 true"] },
  { label: "Nauseas", desc: "Mareo durante 30 s", icon: Frown, cmds: ["effect give {t} minecraft:nausea 30 0 true"] },
  { label: "Hambre", desc: "Vacia la barra de comida", icon: Utensils, cmds: ["effect give {t} minecraft:hunger 30 9 true"] },
  { label: "Lanzar al cielo", desc: "Levitacion 5 s y luego caida (con lentitud de caida para no matar)", icon: ArrowUp, cmds: ["effect give {t} minecraft:levitation 5 9 true", "effect give {t} minecraft:slow_falling 25 0 true"] },
  { label: "Al vacio (con red)", desc: "Teletransporta 60 bloques arriba con caida lenta", icon: Mountain, cmds: ["execute as {t} at @s run tp @s ~ ~60 ~", "effect give {t} minecraft:slow_falling 30 0 true"] },
  { label: "Modo espectador", desc: "No puede interactuar hasta que lo devuelvas", icon: Ghost, cmds: ["gamemode spectator {t}"] },
  { label: "Modo aventura", desc: "No puede romper ni poner bloques", icon: Lock, cmds: ["gamemode adventure {t}"] },
  { label: "Quitar OP", desc: "Retira permisos de operador", icon: ShieldMinus, cmds: ["deop {t}"] },
  { label: "Vaciar inventario", desc: "Borra TODO lo que lleva", icon: Eraser, danger: true, confirm: true, cmds: ["clear {t}"] },
  { label: "Matar", desc: "Muere al instante (pierde el inventario si keepInventory esta apagado)", icon: Skull, danger: true, confirm: true, cmds: ["kill {t}"] },
  { label: "Expulsar", desc: "Kick con motivo", icon: UserX, danger: true, needsMsg: true, cmds: ["kick {t} {m}"] },
  { label: "Banear", desc: "Ban permanente con motivo (se quita en Jugadores)", icon: Ban, danger: true, confirm: true, needsMsg: true, cmds: ["ban {t} {m}"] },
];

const REWARD: Action[] = [
  { label: "Felicitar", desc: "Titulo dorado + mensaje en chat con tu texto", icon: PartyPopper, needsMsg: true, cmds: [...title("{t}", "¡FELICIDADES!", "gold", "{m}"), tell("{t}", "{m}", "gold"), "execute at {t} run summon minecraft:firework_rocket ~ ~1 ~ {LifeTime:20,FireworkItem:{id:\"minecraft:firework_rocket\",count:1,components:{\"minecraft:fireworks\":{explosions:[{shape:\"large_ball\",colors:[I;16766720,16711680,65280],has_trail:true}],flight_duration:1}}}}"] },
  { label: "Anunciar a todos", desc: "Anuncio publico: \"{jugador} ...\"", icon: Megaphone, needsMsg: true, cmds: [`tellraw @a [{"text":"★ ","color":"gold"},{"text":"{t}","color":"yellow","bold":true},{"text":" {m}","color":"gold"}]`] },
  { label: "+10 niveles", desc: "Experiencia", icon: Sparkles, cmds: ["xp add {t} 10 levels"] },
  { label: "+30 niveles", desc: "Experiencia", icon: Sparkles, cmds: ["xp add {t} 30 levels"] },
  { label: "16 diamantes", desc: "give diamond 16", icon: Gem, cmds: ["give {t} minecraft:diamond 16"] },
  { label: "4 lingotes de netherita", desc: "give netherite_ingot 4", icon: Gem, cmds: ["give {t} minecraft:netherite_ingot 4"] },
  { label: "Manzanas doradas", desc: "8 manzanas doradas + 1 encantada", icon: Apple, cmds: ["give {t} minecraft:golden_apple 8", "give {t} minecraft:enchanted_golden_apple 1"] },
  { label: "Totem de la inmortalidad", desc: "Un totem", icon: Heart, cmds: ["give {t} minecraft:totem_of_undying 1"] },
  { label: "Elitros + cohetes", desc: "Elitros con Reparacion y 64 cohetes", icon: Rocket, cmds: ["give {t} minecraft:elytra[enchantments={\"minecraft:unbreaking\":3,\"minecraft:mending\":1}] 1", "give {t} minecraft:firework_rocket 64"] },
  { label: "Buff heroico (10 min)", desc: "Fuerza II, Velocidad II, Resistencia, Regeneracion", icon: Zap, cmds: ["effect give {t} minecraft:strength 600 1 true", "effect give {t} minecraft:speed 600 1 true", "effect give {t} minecraft:resistance 600 0 true", "effect give {t} minecraft:regeneration 600 0 true"] },
  { label: "Curar por completo", desc: "Vida, comida y sin efectos malos", icon: Heart, cmds: ["effect clear {t}", "effect give {t} minecraft:instant_health 1 10 true", "effect give {t} minecraft:saturation 1 10 true"] },
  { label: "Libro encantado Reparacion", desc: "enchanted_book mending", icon: ScrollText, cmds: ["give {t} minecraft:enchanted_book[stored_enchantments={\"minecraft:mending\":1}] 1"] },
  { label: "Esmeraldas", desc: "32 esmeraldas para comerciar", icon: Coins, cmds: ["give {t} minecraft:emerald 32"] },
  { label: "Dar OP", desc: "Permisos de operador", icon: ShieldPlus, confirm: true, cmds: ["op {t}"] },
  { label: "Volver a supervivencia", desc: "Quita espectador/aventura", icon: Anchor, cmds: ["gamemode survival {t}"] },
];

function ActionButton({ a, target, msg, tone }: { a: Action; target: string; msg: string; tone: "bad" | "good" }) {
  const { run, online, running } = useCommands();
  const ready = !!target.trim() && (!a.needsMsg || !!msg.trim());
  const exec = async () => {
    for (const c of a.cmds) { const ok = await run(c.replaceAll("{t}", target.trim()).replaceAll("{m}", msg.trim())); if (!ok) break; }
  };
  const btn = (
    <button disabled={!online || running || !ready} onClick={a.confirm ? undefined : exec}
      className={cn("group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        tone === "bad" ? "hover:border-destructive/50 hover:bg-destructive/10" : "hover:border-primary/50 hover:bg-primary/10",
        a.danger && "border-destructive/30")}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", tone === "bad" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}><a.icon className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium">{a.label}{a.needsMsg && <Badge variant="outline" className="h-4 px-1 text-[9px]">motivo</Badge>}{a.confirm && <Badge variant="outline" className="h-4 border-destructive/40 px-1 text-[9px] text-destructive">confirmar</Badge>}</span>
        <span className="block text-xs text-muted-foreground">{a.desc}</span>
      </span>
    </button>
  );
  if (!a.confirm) return btn;
  return (
    <AlertDialog>
      <AlertDialogTrigger render={btn} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{a.label} a {target}?</AlertDialogTitle>
          <AlertDialogDescription>{a.desc}{msg && <><br />Motivo: <i>{msg}</i></>}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant={tone === "bad" ? "destructive" : "default"} onClick={exec}>Si, {a.label.toLowerCase()}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Board() {
  const { data: server } = useServer(5000);
  const players = server?.players.list ?? [];
  const [target, setTarget] = useState(players[0] ?? "");
  const [msg, setMsg] = useState("");
  const online = server?.status === 1;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Castigos y premios" description="Acciones rapidas sobre un jugador: penitencias para quien se porta mal y recompensas para quien se lo gana.">
        <StatusBadge status={server?.status} />
      </PageHeader>

      <Card>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Jugador objetivo</p>
            <TargetPicker value={target} onChange={setTarget} players={players} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Motivo / mensaje (para las acciones marcadas)</p>
            <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Ej. por griefear la base de Juan / por ganar el evento" />
            <p className="mt-1 text-[11px] text-muted-foreground">Se muestra al jugador en pantalla y en el chat.</p>
          </div>
        </CardContent>
      </Card>

      {!online && <div className="rounded-lg border border-chart-3/30 bg-chart-3/10 px-3 py-2 text-sm text-chart-3">El servidor no esta en linea.</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive"><Gavel className="size-4" />Castigos</CardTitle>
            <CardDescription>Los marcados con &quot;confirmar&quot; piden confirmacion. Ninguno es irreversible salvo matar, vaciar y banear.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {PUNISH.map((a) => <ActionButton key={a.label} a={a} target={target} msg={msg} tone="bad" />)}
          </CardContent>
        </Card>
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary"><Trophy className="size-4" />Premios</CardTitle>
            <CardDescription>Recompensas, buffs y reconocimiento publico.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {REWARD.map((a) => <ActionButton key={a.label} a={a} target={target} msg={msg} tone="good" />)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DisciplinePage() {
  const { data: server } = useServer(5000);
  return <CommandProvider online={server?.status === 1}><Board /></CommandProvider>;
}
