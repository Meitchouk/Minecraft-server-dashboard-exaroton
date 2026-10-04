"use client";
import { useState } from "react";
import { CalendarClock, Gauge, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { usePoll, useDraft } from "@/hooks/use-server";
import { usePermissions } from "@/hooks/use-permissions";
import { AdminBadge } from "@/components/admin-only";
import { apiFetch } from "@/lib/client";

type Ops = {
  restart: { enabled: boolean; times: string[]; warnMin: number[]; reason: string };
  tps: { enabled: boolean; threshold: number; everyMin: number };
};
type OpsStatus = { lastRestart: number | null; lastTps: number | null; lastTpsAt: number | null; nextRestart: number | null; log: { at: number; text: string }[] };
type Resp = { settings: Ops; status: OpsStatus };

const csv = (a: (string | number)[]) => a.join(", ");
const parseList = (s: string) => s.split(/[,\s]+/).filter(Boolean);

// Reinicios programados (con avisos en el juego) y vigilancia del TPS con alerta a Discord
export function OpsCard() {
  const { data, key, setData } = usePoll(() => apiFetch<Resp>("/api/ops"), 0);
  const [draft, setDraft] = useDraft<Ops>(data?.settings ?? null, key);
  const [times, setTimes] = useState<string | null>(null);
  const [warns, setWarns] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const perms = usePermissions();
  const can = perms.can("ops.settings");
  const d = draft;
  if (!d || !data) return null;
  const timesText = times ?? csv(d.restart.times);
  const warnsText = warns ?? csv(d.restart.warnMin);
  const next: Ops = { restart: { ...d.restart, times: parseList(timesText), warnMin: parseList(warnsText).map(Number) }, tps: d.tps };
  const dirty = JSON.stringify(next) !== JSON.stringify(data.settings);

  const save = async () => {
    setSaving(true);
    try {
      const r = await apiFetch<Resp>("/api/ops", { method: "POST", body: JSON.stringify(next) });
      setData(r); setTimes(null); setWarns(null); toast.success("Operacion automatica guardada");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };
  const st = data.status;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" />Reinicios y alertas{perms.ready && !can && <AdminBadge />}</CardTitle>
        <CardDescription>Reinicio diario con avisos en el chat antes de reiniciar, y alerta a Discord si el TPS se mantiene bajo (usa <code className="rounded bg-muted px-1">spark</code>). Corre dentro del panel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <span className="text-sm">Reinicio programado</span>
          <Switch checked={d.restart.enabled} onCheckedChange={(v) => setDraft({ ...d, restart: { ...d.restart, enabled: v } })} disabled={!can} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1"><span className="text-muted-foreground">Horas (HH:MM, hora del panel)</span><Input value={timesText} onChange={(e) => setTimes(e.target.value)} disabled={!can} className="h-8 font-mono" placeholder="05:00, 17:00" /></label>
          <label className="space-y-1"><span className="text-muted-foreground">Avisos (minutos antes)</span><Input value={warnsText} onChange={(e) => setWarns(e.target.value)} disabled={!can} className="h-8 font-mono" placeholder="10, 5, 1" /></label>
        </div>
        <label className="block space-y-1"><span className="text-muted-foreground">Texto del aviso</span><Input value={d.restart.reason} onChange={(e) => setDraft({ ...d, restart: { ...d.restart, reason: e.target.value } })} disabled={!can} className="h-8" maxLength={80} /></label>

        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <span className="flex items-center gap-2 text-sm"><Gauge className="size-4" />Alerta de TPS bajo</span>
          <Switch checked={d.tps.enabled} onCheckedChange={(v) => setDraft({ ...d, tps: { ...d.tps, enabled: v } })} disabled={!can} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1"><span className="text-muted-foreground">Avisar si baja de</span><Input type="number" min={5} max={19.5} step={0.5} value={d.tps.threshold} onChange={(e) => setDraft({ ...d, tps: { ...d.tps, threshold: Number(e.target.value) } })} disabled={!can} className="h-8 font-mono" /></label>
          <label className="space-y-1"><span className="text-muted-foreground">Comprobar cada (min)</span><Input type="number" min={1} max={30} value={d.tps.everyMin} onChange={(e) => setDraft({ ...d, tps: { ...d.tps, everyMin: Number(e.target.value) } })} disabled={!can} className="h-8 font-mono" /></label>
        </div>

        <Button size="sm" onClick={save} disabled={!dirty || saving || !can}>{saving && <Loader2 className="animate-spin" />}Guardar</Button>

        <div className="space-y-0.5 text-[11px] text-muted-foreground">
          {st.nextRestart && <p>Proximo reinicio: {new Date(st.nextRestart).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</p>}
          {st.lastTps != null && <p>Ultimo TPS leido: {st.lastTps.toFixed(1)}{st.lastTpsAt ? ` (${new Date(st.lastTpsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})` : ""}</p>}
          {st.log.slice(0, 4).map((l, i) => <p key={i}>{new Date(l.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {l.text}</p>)}
        </div>
      </CardContent>
    </Card>
  );
}
