"use client";
import { useState } from "react";
import { Sparkles, RefreshCw, Loader2, ListOrdered, Scale, AlertTriangle, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePoll } from "@/hooks/use-server";
import { usePermissions } from "@/hooks/use-permissions";
import { AdminBadge, ReadOnlyNotice } from "@/components/admin-only";
import { apiFetch } from "@/lib/client";
import { IMPROVEMENTS, type Improvement } from "@/lib/improvements";
import { cn } from "@/lib/utils";

type State = { online: boolean; states: Record<string, boolean | null> };

export function ImprovementsTab() {
  const { data, loading, refresh, setData } = usePoll(() => apiFetch<State>("/api/improvements"));
  const perms = usePermissions();
  const canEdit = perms.can("config.write");
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (imp: Improvement, enabled: boolean) => {
    setBusy(imp.id);
    try {
      const r = await apiFetch<{ state: boolean | null; output: string[] }>("/api/improvements", { method: "POST", body: JSON.stringify({ id: imp.id, enabled }) });
      setData({ online: true, states: { ...(data?.states ?? {}), [imp.id]: r.state ?? enabled } });
      toast.success(`${imp.label}: ${enabled ? "activado" : "desactivado"}`, { description: r.output.at(-1) });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const Row = ({ imp }: { imp: Improvement }) => {
    const st = data?.states[imp.id];
    return (
      <div className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5", st && "border-primary/30 bg-primary/5")}>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {imp.label}
            {imp.gameplay && <Badge variant="outline" className="h-4 gap-1 border-chart-3/50 px-1 text-[9px] text-chart-3"><Scale className="size-2.5" />balance</Badge>}
            {st === null && data?.online && (
              <Tooltip><TooltipTrigger render={<span />}><HelpCircle className="size-3.5 text-muted-foreground" /></TooltipTrigger><TooltipContent>No se pudo leer el estado; el interruptor muestra el ultimo valor conocido.</TooltipContent></Tooltip>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{imp.desc}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70" title={imp.on.join(" ; ")}>/{imp.on[0]}</p>
        </div>
        {busy === imp.id ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> :
          <Switch checked={!!st} disabled={!canEdit || !data?.online || loading} onCheckedChange={(v) => toggle(imp, v)} />}
      </div>
    );
  };

  const groups: { id: Improvement["group"]; title: string; desc: string; icon: React.ElementType }[] = [
    { id: "tab", title: "Marcadores (Tab / pantalla)", desc: "Contadores que el juego actualiza solo y se ven al pulsar Tab, en el lateral o bajo el nombre.", icon: ListOrdered },
    { id: "rules", title: "Reglas del mundo", desc: "Gamerules de calidad de vida. Los marcados con \"balance\" cambian la dificultad real del juego.", icon: Scale },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">Se aplican al instante, sin reiniciar. El estado se lee del servidor en vivo.</p>
        <Button size="sm" variant="outline" className="ml-auto" onClick={refresh} disabled={loading}><RefreshCw className={cn(loading && "animate-spin")} />Releer estado</Button>
        {perms.ready && !canEdit && <AdminBadge />}
      </div>
      {perms.ready && !canEdit && <ReadOnlyNotice what="cambiar estas mejoras" />}
      {data && !data.online && (
        <div className="flex items-center gap-2 rounded-lg border border-chart-3/30 bg-chart-3/10 px-3 py-2 text-sm text-chart-3"><AlertTriangle className="size-4" />El servidor esta apagado: no se puede leer ni cambiar el estado.</div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><g.icon className="size-4 text-primary" />{g.title}</CardTitle>
              <CardDescription>{g.desc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading && !data ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />) : IMPROVEMENTS.filter((i) => i.group === g.id).map((imp) => <Row key={imp.id} imp={imp} />)}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="size-3.5 text-primary" />Todo es reversible: apagar un interruptor ejecuta el comando contrario (y en los marcadores borra el objetivo).</p>
    </div>
  );
}
