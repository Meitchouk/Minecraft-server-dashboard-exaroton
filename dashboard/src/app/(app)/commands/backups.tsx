"use client";
import { useState } from "react";
import { DatabaseBackup, Play, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { usePoll, useDraft } from "@/hooks/use-server";
import { apiFetch } from "@/lib/client";

type Settings = { enabled: boolean; intervalMin: number; keepDays: number; enderChest: boolean };
type Status = { running: boolean; lastRun: number | null; lastResult: string | null; nextRun: number | null; players: Record<string, number> };

const ago = (t: number | null) => t ? `${Math.max(0, Math.round((Date.now() - t) / 60000))} min` : "—";
const inMin = (t: number | null) => t ? `${Math.max(0, Math.round((t - Date.now()) / 60000))} min` : "—";

export function BackupsCard({ onRan }: { onRan?: () => void }) {
  const { data: settings, key, setData } = usePoll(() => apiFetch<Settings>("/api/backup/settings"));
  const { data: status, refresh: refreshStatus } = usePoll(() => apiFetch<Status>("/api/backup/status"), 20000);
  const { data: fb } = usePoll(() => apiFetch<{ configured: boolean; reason: string; projectId: string | null }>("/api/firebase/status"), 30000);
  const [draft, setDraft] = useDraft<Settings>(settings, key);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const d = draft ?? { enabled: false, intervalMin: 5, keepDays: 14, enderChest: true };
  const dirty = settings && JSON.stringify(d) !== JSON.stringify(settings);

  const save = async () => {
    setSaving(true);
    try { setData(await apiFetch<Settings>("/api/backup/settings", { method: "POST", body: JSON.stringify(d) })); toast.success("Ajustes de copias guardados"); refreshStatus(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };
  const runNow = async () => {
    setRunning(true);
    try { const r = await apiFetch<{ result: string }>("/api/backup/run", { method: "POST" }); toast.success("Copia ejecutada", { description: r.result }); refreshStatus(); onRan?.(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setRunning(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><DatabaseBackup className="size-4 text-primary" />Copias automaticas</CardTitle>
        <CardDescription>El panel guarda en disco el inventario (y cofre de Ender) de todos los conectados cada cierto tiempo, aunque nadie tenga esta pagina abierta. Asi se pueden recuperar objetos perdidos por bugs o muertes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {fb && (
          <p className={fb.configured ? "rounded-md bg-primary/10 px-2 py-1.5 text-xs text-primary" : "rounded-md bg-chart-3/10 px-2 py-1.5 text-xs text-chart-3"}>
            {fb.configured ? <>Guardando en Firestore ({fb.projectId})</> : <>Guardando en archivos locales. Firestore no configurado: {fb.reason}</>}
          </p>
        )}
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <span className="flex items-center gap-2 text-sm">Activar copias {status?.running && <Badge className="h-4 px-1 text-[10px]">activo</Badge>}</span>
          <Switch checked={d.enabled} onCheckedChange={(v) => setDraft({ ...d, enabled: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <label className="space-y-1"><span className="text-muted-foreground">Cada (min)</span><Input type="number" min={1} max={120} value={d.intervalMin} onChange={(e) => setDraft({ ...d, intervalMin: Number(e.target.value) || 5 })} className="h-8 font-mono" /></label>
          <label className="space-y-1"><span className="text-muted-foreground">Conservar (dias)</span><Input type="number" min={1} max={365} value={d.keepDays} onChange={(e) => setDraft({ ...d, keepDays: Number(e.target.value) || 14 })} className="h-8 font-mono" /></label>
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <span className="text-sm">Incluir cofre de Ender</span>
          <Switch checked={d.enderChest} onCheckedChange={(v) => setDraft({ ...d, enderChest: v })} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={!dirty || saving}>{saving ? <Loader2 className="animate-spin" /> : null}Guardar</Button>
          <Button size="sm" variant="outline" onClick={runNow} disabled={running}>{running ? <Loader2 className="animate-spin" /> : <Play />}Copiar ahora</Button>
        </div>
        {status && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="size-3" />Ultima: hace {ago(status.lastRun)}</span>
            {status.running && <span>Proxima: en {inMin(status.nextRun)}</span>}
            {status.lastResult && <span className="truncate">· {status.lastResult}</span>}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">Nota: cada lectura imprime el inventario en la consola; si <code className="rounded bg-muted px-1">broadcast-console-to-ops</code> esta activo, los OPs veran ese texto en el chat. Puedes desactivarlo en Configuracion.</p>
      </CardContent>
    </Card>
  );
}
