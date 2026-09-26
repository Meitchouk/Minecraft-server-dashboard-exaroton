"use client";
import { useState } from "react";
import { Gavel, Bomb, Trophy, Skull, Flame, EyeOff, Snail, Frown, Utensils, ArrowUp, Lock, Ban, UserX, Eraser, ShieldMinus, Ghost, Mountain, Sparkles, Gem, Apple, Heart, Zap, PartyPopper, Megaphone, ShieldPlus, Coins, ScrollText, AlertTriangle, Anchor, Snowflake, Bird, Drama, Beef, Pickaxe, Wind, Crown, ArrowDownToLine, Volume2, Rabbit, Sun } from "lucide-react";
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
import { usePermissions } from "@/hooks/use-permissions";
import { isDangerousCommand } from "@/lib/permissions";
import { AdminBadge } from "@/components/admin-only";

// {t} = objetivo, {m} = motivo/mensaje escrito por el admin
type Tier = "leve" | "medio" | "grave" | "pequeno" | "especial" | "sonido" | "broma";
type Action = { label: string; desc: string; icon: React.ElementType; cmds: string[]; danger?: boolean; confirm?: boolean; needsMsg?: boolean; tier: Tier };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const tell = (t: string, text: string, color: string) => `tellraw ${t} {"text":"${esc(text)}","color":"${color}","bold":true}`;
const title = (t: string, text: string, color: string, sub?: string) => [
  `title ${t} times 10 70 20`,
  ...(sub ? [`title ${t} subtitle {"text":"${esc(sub)}","color":"gray"}`] : []),
  `title ${t} title {"text":"${esc(text)}","color":"${color}","bold":true}`,
];

const PUNISH: Action[] = [
  // ---- leves: molestan, no hacen daño real ----
  { tier: "leve", label: "Advertencia", desc: "Titulo rojo en pantalla + mensaje en chat con el motivo", icon: AlertTriangle, needsMsg: true, cmds: [...title("{t}", "ADVERTENCIA", "red", "{m}"), tell("{t}", "Advertencia del administrador: {m}", "red")] },
  { tier: "leve", label: "Advertencia publica", desc: "Todos ven en el chat que fue advertido y por que", icon: Volume2, needsMsg: true, cmds: [`tellraw @a [{"text":"⚠ ","color":"red"},{"text":"{t}","color":"yellow","bold":true},{"text":" ha sido advertido: {m}","color":"red"}]`] },
  { tier: "leve", label: "Nauseas", desc: "Mareo durante 30 s", icon: Frown, cmds: ["effect give {t} minecraft:nausea 30 0 true"] },
  { tier: "leve", label: "Ceguera", desc: "Ceguera + oscuridad 30 s", icon: EyeOff, cmds: ["effect give {t} minecraft:blindness 30 0 true", "effect give {t} minecraft:darkness 30 0 true"] },
  { tier: "leve", label: "Sin saltar", desc: "No puede saltar durante 60 s", icon: ArrowDownToLine, cmds: ["effect give {t} minecraft:jump_boost 60 128 true"] },
  { tier: "leve", label: "Lluvia de pollos", desc: "12 pollos le caen encima (inofensivo, ruidoso)", icon: Bird, cmds: Array.from({ length: 12 }, () => "execute at {t} run summon minecraft:chicken ~ ~6 ~") },
  { tier: "leve", label: "Conejos", desc: "8 conejos alrededor para distraer", icon: Rabbit, cmds: Array.from({ length: 8 }, () => "execute at {t} run summon minecraft:rabbit ~ ~1 ~") },
  { tier: "leve", label: "Lanzar al cielo", desc: "Levitacion 5 s y caida suave (no muere)", icon: ArrowUp, cmds: ["effect give {t} minecraft:levitation 5 9 true", "effect give {t} minecraft:slow_falling 25 0 true"] },
  // ---- medios: castigan de verdad pero son reversibles ----
  { tier: "medio", label: "Congelar 20 s", desc: "No puede moverse ni minar", icon: Snowflake, cmds: ["effect give {t} minecraft:slowness 20 255 true", "effect give {t} minecraft:mining_fatigue 20 255 true", "effect give {t} minecraft:jump_boost 20 128 true"] },
  { tier: "medio", label: "Lentitud extrema", desc: "Lentitud V + fatiga de minero 60 s", icon: Snail, cmds: ["effect give {t} minecraft:slowness 60 4 true", "effect give {t} minecraft:mining_fatigue 60 2 true"] },
  { tier: "medio", label: "Debilidad", desc: "Debilidad II + hambre durante 2 min", icon: Utensils, cmds: ["effect give {t} minecraft:weakness 120 1 true", "effect give {t} minecraft:hunger 120 2 true"] },
  { tier: "medio", label: "Envenenar", desc: "Veneno II 20 s (no mata, deja en medio corazon)", icon: Skull, cmds: ["effect give {t} minecraft:poison 20 1 true"] },
  { tier: "medio", label: "Rayo divino", desc: "Le cae un rayo encima (dano + fuego)", icon: Flame, cmds: ["execute at {t} run summon minecraft:lightning_bolt ~ ~ ~"] },
  { tier: "medio", label: "Susto: zombis", desc: "4 zombis a su alrededor", icon: Drama, cmds: Array.from({ length: 4 }, () => "execute at {t} run summon minecraft:zombie ~ ~ ~"), confirm: true },
  { tier: "medio", label: "Al vacio (con red)", desc: "60 bloques arriba con caida lenta", icon: Mountain, cmds: ["execute as {t} at @s run tp @s ~ ~60 ~", "effect give {t} minecraft:slow_falling 30 0 true"] },
  { tier: "medio", label: "Quitar niveles", desc: "Pierde toda la experiencia", icon: Sparkles, confirm: true, cmds: ["xp set {t} 0 levels", "xp set {t} 0 points"] },
  { tier: "medio", label: "Multa: 5 diamantes", desc: "Se le quitan hasta 5 diamantes del inventario", icon: Gem, confirm: true, cmds: ["clear {t} minecraft:diamond 5"] },
  { tier: "medio", label: "Modo aventura", desc: "No puede romper ni poner bloques (revertir con 'Volver a supervivencia')", icon: Lock, cmds: ["gamemode adventure {t}"] },
  { tier: "medio", label: "Modo espectador", desc: "No puede interactuar hasta que lo devuelvas", icon: Ghost, cmds: ["gamemode spectator {t}"] },
  // ---- graves: irreversibles o de acceso ----
  { tier: "grave", label: "Vaciar inventario", desc: "Borra TODO lo que lleva (queda copia en Inventario > papelera si se hace desde ahi)", icon: Eraser, danger: true, confirm: true, cmds: ["clear {t}"] },
  { tier: "grave", label: "Matar", desc: "Muere al instante (pierde el inventario si keep_inventory esta apagado)", icon: Skull, danger: true, confirm: true, cmds: ["kill {t}"] },
  { tier: "grave", label: "Quitar OP", desc: "Retira permisos de operador", icon: ShieldMinus, danger: true, cmds: ["deop {t}"] },
  { tier: "grave", label: "Expulsar", desc: "Kick con motivo", icon: UserX, danger: true, needsMsg: true, cmds: ["kick {t} {m}"] },
  { tier: "grave", label: "Banear", desc: "Ban permanente con motivo (se quita en Jugadores)", icon: Ban, danger: true, confirm: true, needsMsg: true, cmds: ["ban {t} {m}"] },
];


// Bromas: inofensivas, no quitan vida ni objetos y se pasan solas
const PRANKS: Action[] = [
  // ---- sonidos: solo los oye el objetivo ----
  { tier: "sonido", label: "Creeper a punto", desc: "Siseo de creeper justo detras", icon: Bomb, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.creeper.primed hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Warden", desc: "El Warden emerge a su lado", icon: Ghost, cmds: ["execute at {t} run playsound minecraft:entity.warden.emerge hostile {t} ~ ~ ~ 1 1", "execute at {t} run playsound minecraft:entity.warden.heartbeat hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Explosion", desc: "Estruendo de TNT (sin explosion real)", icon: Flame, cmds: ["execute at {t} run playsound minecraft:entity.generic.explode hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Enderman", desc: "Grito de enderman enfadado detras", icon: EyeOff, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.enderman.scream hostile {t} ^ ^ ^-3 1 1", "execute at {t} run playsound minecraft:entity.enderman.teleport hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Ghast", desc: "Chillido de ghast lejano", icon: Frown, cmds: ["execute at {t} run playsound minecraft:entity.ghast.scream hostile {t} ~ ~ ~ 1 0.8"] },
  { tier: "sonido", label: "Cueva", desc: "Ruido ambiental de cueva (el clasico)", icon: Mountain, cmds: ["execute at {t} run playsound minecraft:ambient.cave hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Pasos de zombi", desc: "Gruñido de zombi y golpe en la puerta", icon: Drama, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.zombie.ambient hostile {t} ^ ^ ^-3 1 1", "execute at {t} run playsound minecraft:entity.zombie.attack_wooden_door hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Elder guardian", desc: "Maldicion del guardian (sonido + imagen, sin efecto)", icon: Skull, cmds: ["execute at {t} run playsound minecraft:entity.elder_guardian.curse hostile {t} ~ ~ ~ 1 1", "particle minecraft:elder_guardian ~ ~ ~ 0 0 0 0 1 force {t}"] },
  { tier: "sonido", label: "Raid", desc: "Cuerno de asalto de illagers", icon: Megaphone, cmds: ["execute at {t} run playsound minecraft:event.raid.horn hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Wither", desc: "Rugido de spawn del Wither", icon: Skull, cmds: ["execute at {t} run playsound minecraft:entity.wither.spawn hostile {t} ~ ~ ~ 0.6 1"] },
  { tier: "sonido", label: "Totem", desc: "Suena y se ve un totem salvandolo (sin gastar nada)", icon: Sparkles, cmds: ["execute at {t} run playsound minecraft:item.totem.use hostile {t} ~ ~ ~ 1 1", "particle minecraft:totem_of_undying ~ ~1 ~ 0.5 1 0.5 0.5 60 force {t}"] },
  // ---- bromas: molestan un rato, sin daño ----
  { tier: "broma", label: "Mareo", desc: "Nauseas 30 s", icon: Frown, cmds: ["effect give {t} minecraft:nausea 30 0 true"] },
  { tier: "broma", label: "Lento", desc: "Lentitud IV 30 s", icon: Snail, cmds: ["effect give {t} minecraft:slowness 30 3 true"] },
  { tier: "broma", label: "Saltito", desc: "Levitacion 4 s con caida lenta (no muere)", icon: ArrowUp, cmds: ["effect give {t} minecraft:levitation 4 1 true", "effect give {t} minecraft:slow_falling 20 0 true"] },
  { tier: "broma", label: "A oscuras", desc: "Ceguera + fatiga de minero 20 s", icon: EyeOff, cmds: ["effect give {t} minecraft:blindness 20 0 true", "effect give {t} minecraft:mining_fatigue 20 4 true"] },
  { tier: "broma", label: "Te vigilan", desc: "Titulo inquietante en pantalla + latido", icon: AlertTriangle, cmds: ["title {t} times 10 60 20", 'title {t} title {"text":"Te estan vigilando...","color":"dark_red","bold":true}', "execute at {t} run playsound minecraft:entity.warden.heartbeat hostile {t} ~ ~ ~ 1 1"] },
  { tier: "broma", label: "Gallinas", desc: "6 gallinas a su alrededor", icon: Bird, cmds: Array.from({ length: 6 }, (_, i) => `execute at {t} run summon minecraft:chicken ~${(i % 3) - 1} ~ ~${Math.floor(i / 3) * 2 - 1}`) },
  { tier: "broma", label: "Quitar todo", desc: "Limpia todos sus efectos (deshace las bromas)", icon: Heart, cmds: ["effect clear {t}"] },
];

// Premios moderados: nada que rompa la progresion de un survival
const REWARD: Action[] = [
  // ---- pequeños: reconocimiento y detalles ----
  { tier: "pequeno", label: "Felicitar", desc: "Titulo dorado + mensaje privado + fuegos artificiales", icon: PartyPopper, needsMsg: true, cmds: [...title("{t}", "¡FELICIDADES!", "gold", "{m}"), tell("{t}", "{m}", "gold"), "execute at {t} run summon minecraft:firework_rocket ~ ~1 ~ {LifeTime:20,FireworkItem:{id:\"minecraft:firework_rocket\",count:1,components:{\"minecraft:fireworks\":{explosions:[{shape:\"large_ball\",colors:[I;16766720,16711680,65280],has_trail:true}],flight_duration:1}}}}"] },
  { tier: "pequeno", label: "Anunciar a todos", desc: "Anuncio publico: \"★ {jugador} ...\"", icon: Megaphone, needsMsg: true, cmds: [`tellraw @a [{"text":"★ ","color":"gold"},{"text":"{t}","color":"yellow","bold":true},{"text":" {m}","color":"gold"}]`] },
  { tier: "pequeno", label: "MVP del dia", desc: "Titulo para TODOS: '{jugador} es el MVP de hoy' + fuegos", icon: Crown, cmds: [`title @a times 10 80 20`, `title @a subtitle {"text":"{t}","color":"yellow","bold":true}`, `title @a title {"text":"MVP DE HOY","color":"gold","bold":true}`, "execute at {t} run summon minecraft:firework_rocket ~ ~1 ~ {LifeTime:25}", "execute at {t} run summon minecraft:firework_rocket ~2 ~1 ~ {LifeTime:30}", "execute at {t} run summon minecraft:firework_rocket ~-2 ~1 ~ {LifeTime:35}"] },
  { tier: "pequeno", label: "Curar", desc: "Vida y comida al maximo, sin efectos malos", icon: Heart, cmds: ["effect clear {t}", "effect give {t} minecraft:instant_health 1 10 true", "effect give {t} minecraft:saturation 1 10 true"] },
  { tier: "pequeno", label: "+5 niveles", desc: "Experiencia", icon: Sparkles, cmds: ["xp add {t} 5 levels"] },
  { tier: "pequeno", label: "Comida", desc: "16 filetes cocinados + 8 panes", icon: Beef, cmds: ["give {t} minecraft:cooked_beef 16", "give {t} minecraft:bread 8"] },
  { tier: "pequeno", label: "Frascos de XP", desc: "8 frascos de experiencia", icon: Sparkles, cmds: ["give {t} minecraft:experience_bottle 8"] },
  { tier: "pequeno", label: "Flechas y antorchas", desc: "32 flechas + 32 antorchas", icon: Sun, cmds: ["give {t} minecraft:arrow 32", "give {t} minecraft:torch 32"] },
  // ---- especiales: valen algo, pero se consiguen jugando en poco tiempo ----
  { tier: "especial", label: "3 diamantes", desc: "give diamond 3", icon: Gem, cmds: ["give {t} minecraft:diamond 3"] },
  { tier: "especial", label: "Lote de hierro", desc: "16 lingotes de hierro + 8 de oro", icon: Pickaxe, cmds: ["give {t} minecraft:iron_ingot 16", "give {t} minecraft:gold_ingot 8"] },
  { tier: "especial", label: "16 esmeraldas", desc: "Para comerciar con aldeanos", icon: Coins, cmds: ["give {t} minecraft:emerald 16"] },
  { tier: "especial", label: "Manzana dorada", desc: "1 manzana dorada (normal)", icon: Apple, cmds: ["give {t} minecraft:golden_apple 1"] },
  { tier: "especial", label: "Pico de hierro encantado", desc: "Eficiencia II + Irrompibilidad I", icon: Pickaxe, cmds: ["give {t} minecraft:iron_pickaxe[enchantments={\"minecraft:efficiency\":2,\"minecraft:unbreaking\":1}] 1"] },
  { tier: "especial", label: "Libro: Irrompibilidad I", desc: "Libro encantado modesto", icon: ScrollText, cmds: ["give {t} minecraft:enchanted_book[stored_enchantments={\"minecraft:unbreaking\":1}] 1"] },
  { tier: "especial", label: "Caballo con silla", desc: "Invoca un caballo domesticado a su lado + una silla", icon: Wind, cmds: ["execute at {t} run summon minecraft:horse ~1 ~ ~1 {Tame:1b,Health:30f}", "give {t} minecraft:saddle 1"] },
  { tier: "especial", label: "Buff de trabajo (5 min)", desc: "Prisa I + Velocidad I durante 5 min", icon: Zap, cmds: ["effect give {t} minecraft:haste 300 0 true", "effect give {t} minecraft:speed 300 0 true"] },
  { tier: "especial", label: "Suerte (10 min)", desc: "Mejor botin al pescar y en cofres", icon: Zap, cmds: ["effect give {t} minecraft:luck 600 0 true"] },
  // ---- administracion ----
  { tier: "especial", label: "Dar OP", desc: "Permisos de operador", icon: ShieldPlus, confirm: true, cmds: ["op {t}"] },
  { tier: "especial", label: "Volver a supervivencia", desc: "Quita espectador/aventura (revierte castigos)", icon: Anchor, cmds: ["gamemode survival {t}"] },
];

const TIERS: Record<Tier, { label: string; desc: string }> = {
  leve: { label: "Leves", desc: "Molestan sin hacer daño real" },
  medio: { label: "Medios", desc: "Castigan de verdad, pero se revierten solos o con un clic" },
  grave: { label: "Graves", desc: "Irreversibles o de acceso: piden confirmacion" },
  pequeno: { label: "Pequeños", desc: "Reconocimiento y detalles que no alteran el juego" },
  especial: { label: "Especiales", desc: "Valen algo, pero nada que no se consiga jugando un rato" },
  sonido: { label: "Sonidos", desc: "Solo los oye el jugador elegido; sin mobs ni daño" },
  broma: { label: "Molestias", desc: "Efectos cortos, sin daño ni perdida de objetos" },
};

function Group({ list, tier, target, msg, tone }: { list: Action[]; tier: Tier; target: string; msg: string; tone: "bad" | "good" | "fun" }) {
  const items = list.filter((a) => a.tier === tier);
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2"><span className={cn("text-xs font-semibold uppercase tracking-wider", tone === "bad" ? "text-destructive" : tone === "fun" ? "text-chart-4" : "text-primary")}>{TIERS[tier].label}</span><span className="text-[11px] text-muted-foreground">{TIERS[tier].desc}</span></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{items.map((a) => <ActionButton key={a.label} a={a} target={target} msg={msg} tone={tone} />)}</div>
    </div>
  );
}

function ActionButton({ a, target, msg, tone }: { a: Action; target: string; msg: string; tone: "bad" | "good" | "fun" }) {
  const { run, online, running } = useCommands();
  const perms = usePermissions();
  const resolved = a.cmds.map((c) => c.replaceAll("{t}", target.trim() || "x").replaceAll("{m}", msg.trim() || "x"));
  const adminOnly = !perms.can("command.dangerous") && resolved.some(isDangerousCommand);
  const ready = !!target.trim() && (!a.needsMsg || !!msg.trim()) && !adminOnly;
  const exec = async () => {
    for (const c of a.cmds) { const ok = await run(c.replaceAll("{t}", target.trim()).replaceAll("{m}", msg.trim())); if (!ok) break; }
  };
  const btn = (
    <button disabled={!online || running || !ready} onClick={a.confirm ? undefined : exec}
      className={cn("group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        tone === "bad" ? "hover:border-destructive/50 hover:bg-destructive/10" : tone === "fun" ? "hover:border-chart-4/50 hover:bg-chart-4/10" : "hover:border-primary/50 hover:bg-primary/10",
        a.danger && "border-destructive/30")}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", tone === "bad" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}><a.icon className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium">{a.label}{a.needsMsg && <Badge variant="outline" className="h-4 px-1 text-[9px]">motivo</Badge>}{a.confirm && <Badge variant="outline" className="h-4 border-destructive/40 px-1 text-[9px] text-destructive">confirmar</Badge>}{adminOnly && <AdminBadge />}</span>
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
            <CardDescription>De menor a mayor. Los marcados con &quot;confirmar&quot; piden confirmacion; los graves son irreversibles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(["leve", "medio", "grave"] as Tier[]).map((t) => <Group key={t} list={PUNISH} tier={t} target={target} msg={msg} tone="bad" />)}
          </CardContent>
        </Card>
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary"><Trophy className="size-4" />Premios</CardTitle>
            <CardDescription>Recompensas moderadas: reconocimiento, comida, algo de recursos y buffs cortos. Nada que rompa el survival.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(["pequeno", "especial"] as Tier[]).map((t) => <Group key={t} list={REWARD} tier={t} target={target} msg={msg} tone="good" />)}
          </CardContent>
        </Card>
      </div>

      <Card className="border-chart-4/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-chart-4"><Drama className="size-4" />Bromas</CardTitle>
          <CardDescription>Para divertirse entre amigos: sustos con sonido y molestias cortas. Nadie pierde vida ni objetos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          {(["sonido", "broma"] as Tier[]).map((t) => <Group key={t} list={PRANKS} tier={t} target={target} msg={msg} tone="fun" />)}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DisciplinePage() {
  const { data: server } = useServer(5000);
  return <CommandProvider online={server?.status === 1}><Board /></CommandProvider>;
}
