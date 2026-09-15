"use client";
import { useMemo, useState } from "react";
import { Save, RotateCcw, Search, AlertTriangle, Shield, Gamepad2, Globe2, Gauge, Package2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useDraft, usePoll, useServer } from "@/hooks/use-server";
import { apiFetch, type ConfigOption } from "@/lib/client";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { ReadOnlyNotice } from "@/components/admin-only";

// Agrupacion y ayudas para las opciones mas comunes
const GROUPS: { id: string; title: string; icon: React.ElementType; keys: string[] }[] = [
  { id: "game", title: "Juego", icon: Gamepad2, keys: ["gamemode", "difficulty", "hardcore", "force-gamemode", "pvp", "allow-flight", "spawn-protection", "max-players", "player-idle-timeout", "spawn-monsters", "spawn-animals", "spawn-npcs", "allow-nether", "enable-command-block"] },
  { id: "access", title: "Acceso y seguridad", icon: Shield, keys: ["white-list", "enforce-whitelist", "online-mode", "enforce-secure-profile", "hide-online-players", "op-permission-level", "function-permission-level", "broadcast-console-to-ops", "enable-code-of-conduct", "previews-chat"] },
  { id: "world", title: "Mundo", icon: Globe2, keys: ["level-name", "level-seed", "level-type", "generator-settings", "generate-structures", "max-world-size", "max-build-height"] },
  { id: "perf", title: "Rendimiento", icon: Gauge, keys: ["view-distance", "simulation-distance", "entity-broadcast-range-percentage", "max-chained-neighbor-updates", "pause-when-empty-seconds", "use-native-transport", "max-tick-time", "network-compression-threshold"] },
  { id: "pack", title: "Resource pack", icon: Package2, keys: ["require-resource-pack", "resource-pack", "resource-pack-sha1", "resource-pack-id", "resource-pack-prompt"] },
];

const HINTS: Record<string, string> = {
  "online-mode": "Exaroton lo muestra invertido como \"Cracked\". Desactivado = permite cuentas no premium (menos seguro).",
  "white-list": "Solo pueden entrar los jugadores de la whitelist (pestaña Jugadores).",
  "enforce-whitelist": "Expulsa al instante a quien no este en la whitelist al recargarla.",
  "view-distance": "Chunks visibles por jugador. Mas alto = mas RAM y CPU.",
  "simulation-distance": "Chunks donde se simulan mobs/cultivos. Impacta mas que view-distance.",
  "spawn-protection": "Radio (bloques) protegido alrededor del spawn. 0 = sin proteccion.",
  "player-idle-timeout": "Minutos de inactividad antes de expulsar. 0 = nunca.",
  "pause-when-empty-seconds": "Pausa la simulacion cuando no hay jugadores.",
  "max-players": "Slots maximos.",
  "hardcore": "Muerte permanente: los jugadores quedan en espectador al morir.",
};

const isDirty = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

function Field({ opt, value, onChange }: { opt: ConfigOption; value: unknown; onChange: (v: unknown) => void }) {
  switch (opt.type) {
    case "boolean":
      return <Switch checked={Boolean(value)} onCheckedChange={(v) => onChange(v)} />;
    case "select": {
      const items = Object.fromEntries((opt.options ?? []).map((o) => [o, o]));
      return (
        <Select value={String(value ?? "")} onValueChange={(v) => onChange(v)} items={items}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{(opt.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    case "integer":
    case "float":
      return (
        <Input type="number" className="w-44 font-mono" value={value === null || value === undefined ? "" : String(value)}
          min={opt.min ?? undefined} max={opt.max ?? undefined} step={opt.step ?? (opt.type === "float" ? 0.1 : 1)}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
      );
    case "multiselect":
      return (
        <div className="flex flex-wrap gap-1.5">
          {(opt.options ?? []).map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const on = arr.includes(o);
            return <Button key={o} size="xs" variant={on ? "default" : "outline"} onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}>{o}</Button>;
          })}
        </div>
      );
    default:
      return <Input className="w-64 font-mono" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  }
}

export default function ConfigPage() {
  const { data: server } = useServer(8000);
  const { data: options, loading, error, refresh, setData, key } = usePoll(() => apiFetch<ConfigOption[]>("/api/server/files/config?path=server.properties"));
  const initial = useMemo(() => Object.fromEntries((options ?? []).map((o) => [o.key, o.value])), [options]);
  const [draftState, setDraft] = useDraft<Record<string, unknown>>(initial, key);
  const draft = useMemo(() => draftState ?? {}, [draftState]);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const perms = usePermissions();
  const canWrite = perms.can("config.write");

  const changed = useMemo(() => (options ?? []).filter((o) => isDirty(o.value, draft[o.key])), [options, draft]);

  const grouped = useMemo(() => {
    const all = options ?? [];
    const used = new Set<string>();
    const groups = GROUPS.map((g) => {
      const items = g.keys.map((k) => all.find((o) => o.key === k)).filter(Boolean) as ConfigOption[];
      items.forEach((i) => used.add(i.key));
      return { ...g, items };
    });
    const rest = all.filter((o) => !used.has(o.key));
    if (rest.length) groups.push({ id: "other", title: "Otros", icon: Package2, keys: [], items: rest });
    const needle = q.trim().toLowerCase();
    return groups
      .map((g) => ({ ...g, items: needle ? g.items.filter((o) => o.key.includes(needle) || o.label.toLowerCase().includes(needle)) : g.items }))
      .filter((g) => g.items.length);
  }, [options, q]);

  const save = async () => {
    if (!changed.length) return;
    setSaving(true);
    const payload = Object.fromEntries(changed.map((o) => [o.key, draft[o.key]]));
    const id = toast.loading(`Guardando ${changed.length} cambio(s)…`);
    try {
      const res = await apiFetch<ConfigOption[]>("/api/server/files/config?path=server.properties", { method: "POST", body: JSON.stringify(payload) });
      setData(res);
      toast.success("Configuracion guardada", { id, description: server?.status === 1 ? "Reinicia el servidor para aplicar los cambios." : undefined });
    } catch (e) { toast.error("No se pudo guardar", { id, description: (e as Error).message }); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Configuracion" description="server.properties — se aplica al reiniciar el servidor.">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar opcion…" className="w-56 pl-8" />
        </div>
        <Button variant="outline" size="sm" onClick={() => { refresh(); toast.info("Recargado"); }}><RotateCcw />Recargar</Button>
      </PageHeader>

      {perms.ready && !canWrite && <ReadOnlyNotice what="editar server.properties" />}
      {server?.status === 1 && (
        <div className="flex items-center gap-2 rounded-lg border border-chart-3/30 bg-chart-3/10 px-3 py-2 text-sm text-chart-3">
          <AlertTriangle className="size-4 shrink-0" /> El servidor esta en linea: los cambios se guardan pero se aplican al reiniciar.
        </div>
      )}
      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      {loading && !options ? (
        <div className="grid gap-4 md:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {grouped.map((g) => (
            <Card key={g.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><g.icon className="size-4 text-primary" />{g.title}</CardTitle>
                <CardDescription>{g.items.length} opciones</CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                {g.items.map((o) => {
                  const dirty = isDirty(o.value, draft[o.key]);
                  return (
                    <div key={o.key} className={cn("flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0", dirty && "-mx-2 rounded-md bg-primary/5 px-2")}>
                      <div className="min-w-0 flex-1">
                        <Label className="flex items-center gap-2">{o.label}{dirty && <Badge className="h-4 px-1 text-[10px]">modificado</Badge>}</Label>
                        <p className="font-mono text-[11px] text-muted-foreground">{o.key}</p>
                        {HINTS[o.key] && <p className="mt-0.5 text-xs text-muted-foreground">{HINTS[o.key]}</p>}
                      </div>
                      <div className={cn(!canWrite && "pointer-events-none opacity-60")}><Field opt={o} value={draft[o.key]} onChange={(v) => setDraft((d) => ({ ...d, [o.key]: v }))} /></div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Save bar */}
      <div className={cn(
        "sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-3 rounded-full border bg-popover/90 px-4 py-2 shadow-xl backdrop-blur transition-all",
        changed.length ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}>
        <span className="text-sm"><b>{changed.length}</b> cambio(s) sin guardar</span>
        <Button size="sm" variant="ghost" onClick={() => setDraft(initial)}>Descartar</Button>
        <Button size="sm" onClick={save} disabled={saving || !canWrite}><Save />Guardar</Button>
      </div>
    </div>
  );
}
