"use client";
import { useState } from "react";
import { Sun, Moon, CloudRain, CloudLightning, CloudSun, Heart, Drumstick, Skull, Eraser, Sparkles, ShieldPlus, ShieldMinus, UserX, Save, Megaphone, Gamepad2, Globe2, Wrench, Swords, Flag } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TargetPicker } from "@/components/target-picker";
import { useCommands } from "@/components/command-runner";
import { usePermissions } from "@/hooks/use-permissions";
import { isDangerousCommand } from "@/lib/permissions";
import { AdminBadge } from "@/components/admin-only";

type Q = { label: string; cmd: string; icon?: React.ElementType; variant?: "default" | "secondary" | "outline" | "destructive" };

// {t} se reemplaza por el objetivo seleccionado
const GROUPS: { title: string; desc: string; icon: React.ElementType; needsTarget?: boolean; items: Q[] }[] = [
  { title: "Tiempo y clima", desc: "Cambios instantaneos del mundo", icon: CloudSun, items: [
    { label: "Dia", cmd: "time set day", icon: Sun }, { label: "Mediodia", cmd: "time set noon", icon: Sun },
    { label: "Noche", cmd: "time set night", icon: Moon }, { label: "Medianoche", cmd: "time set midnight", icon: Moon },
    { label: "Despejado", cmd: "weather clear 100000", icon: CloudSun }, { label: "Lluvia", cmd: "weather rain", icon: CloudRain }, { label: "Tormenta", cmd: "weather thunder", icon: CloudLightning },
    { label: "Ciclo dia ON", cmd: "gamerule advance_time true", variant: "outline" }, { label: "Ciclo dia OFF", cmd: "gamerule advance_time false", variant: "outline" },
    { label: "Clima ON", cmd: "gamerule advance_weather true", variant: "outline" }, { label: "Clima OFF", cmd: "gamerule advance_weather false", variant: "outline" },
  ]},
  { title: "Jugador", desc: "Acciones sobre el objetivo seleccionado", icon: Gamepad2, needsTarget: true, items: [
    { label: "Curar", cmd: "effect give {t} minecraft:instant_health 1 10 true", icon: Heart },
    { label: "Alimentar", cmd: "effect give {t} minecraft:saturation 1 10 true", icon: Drumstick },
    { label: "Quitar efectos", cmd: "effect clear {t}", icon: Eraser, variant: "outline" },
    { label: "Supervivencia", cmd: "gamemode survival {t}", variant: "secondary" }, { label: "Creativo", cmd: "gamemode creative {t}", variant: "secondary" },
    { label: "Aventura", cmd: "gamemode adventure {t}", variant: "secondary" }, { label: "Espectador", cmd: "gamemode spectator {t}", variant: "secondary" },
    { label: "+1 nivel", cmd: "xp add {t} 1 levels", icon: Sparkles, variant: "outline" }, { label: "+10 niveles", cmd: "xp add {t} 10 levels", icon: Sparkles, variant: "outline" },
    { label: "Vaciar inventario", cmd: "clear {t}", icon: Eraser, variant: "destructive" },
    { label: "Matar", cmd: "kill {t}", icon: Skull, variant: "destructive" },
    { label: "Dar OP", cmd: "op {t}", icon: ShieldPlus, variant: "outline" }, { label: "Quitar OP", cmd: "deop {t}", icon: ShieldMinus, variant: "outline" },
    { label: "Expulsar", cmd: "kick {t}", icon: UserX, variant: "destructive" },
  ]},
  { title: "Reglas del mundo", desc: "Dificultad y gamerules comunes", icon: Globe2, items: [
    { label: "Pacifico", cmd: "difficulty peaceful", variant: "secondary" }, { label: "Facil", cmd: "difficulty easy", variant: "secondary" },
    { label: "Normal", cmd: "difficulty normal", variant: "secondary" }, { label: "Dificil", cmd: "difficulty hard", variant: "secondary" },
    { label: "keepInventory ON", cmd: "gamerule keep_inventory true", variant: "outline" }, { label: "keepInventory OFF", cmd: "gamerule keep_inventory false", variant: "outline" },
    { label: "mobGriefing ON", cmd: "gamerule mob_griefing true", variant: "outline" }, { label: "mobGriefing OFF", cmd: "gamerule mob_griefing false", variant: "outline" },
    { label: "PvP ON", cmd: "gamerule pvp true", icon: Swords, variant: "outline" }, { label: "PvP OFF", cmd: "gamerule pvp false", icon: Swords, variant: "outline" },
    { label: "Phantoms OFF", cmd: "gamerule spawn_phantoms false", variant: "outline" }, { label: "Phantoms ON", cmd: "gamerule spawn_phantoms true", variant: "outline" },
    { label: "Mobs spawn OFF", cmd: "gamerule spawn_mobs false", variant: "outline" }, { label: "Mobs spawn ON", cmd: "gamerule spawn_mobs true", variant: "outline" },
    { label: "Ver semilla", cmd: "seed", icon: Flag, variant: "outline" },
  ]},
  { title: "Servidor", desc: "Mantenimiento y administracion", icon: Wrench, items: [
    { label: "Guardar mundo", cmd: "save-all", icon: Save },
    { label: "Lista jugadores", cmd: "list", variant: "secondary" },
    { label: "Whitelist ON", cmd: "whitelist on", variant: "outline" }, { label: "Whitelist OFF", cmd: "whitelist off", variant: "outline" }, { label: "Whitelist reload", cmd: "whitelist reload", variant: "outline" },
    { label: "Recargar datapacks", cmd: "reload", variant: "outline" },
    { label: "Auto-guardado OFF", cmd: "save-off", variant: "destructive" }, { label: "Auto-guardado ON", cmd: "save-on", variant: "outline" },
  ]},
];

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export function QuickCommands({ players }: { players: string[] }) {
  const { run, online, running } = useCommands();
  const perms = usePermissions();
  const [target, setTarget] = useState("@a");
  const [msg, setMsg] = useState("");
  const [title, setTitle] = useState("");

  const say = () => msg && run(`say ${msg}`).then((ok) => ok && setMsg(""));
  const showTitle = () => title && run(`title @a title "${esc(title)}"`).then((ok) => ok && setTitle(""));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone className="size-4 text-primary" />Anunciar</CardTitle>
          <CardDescription>Mensaje en el chat o titulo grande en pantalla para todos</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="flex gap-2">
            <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Mensaje de chat…" onKeyDown={(e) => e.key === "Enter" && say()} />
            <Button disabled={!online || !msg || running} onClick={say}>say</Button>
          </div>
          <div className="flex gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titulo en pantalla…" onKeyDown={(e) => e.key === "Enter" && showTitle()} />
            <Button variant="secondary" disabled={!online || !title || running} onClick={showTitle}>title</Button>
          </div>
        </CardContent>
      </Card>

      {GROUPS.map((g) => (
        <Card key={g.title} className={g.needsTarget ? "lg:col-span-2" : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><g.icon className="size-4 text-primary" />{g.title}</CardTitle>
            <CardDescription>{g.desc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {g.needsTarget && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Objetivo</p>
                <TargetPicker value={target} onChange={setTarget} players={players} />
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((it) => {
                const cmd = it.cmd.replaceAll("{t}", target.trim());
                const locked = !perms.can("command.dangerous") && isDangerousCommand(cmd);
                return (
                  <Button key={it.label} size="sm" variant={it.variant ?? "default"} disabled={locked || !online || running || (g.needsTarget && !target.trim())}
                    onClick={() => run(cmd)} title={locked ? perms.why("command.dangerous") : `/${cmd}`}>
                    {it.icon && <it.icon />}{it.label}{locked && <AdminBadge />}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
