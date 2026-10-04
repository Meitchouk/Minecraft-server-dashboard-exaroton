"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Gauge, DatabaseBackup, CalendarClock, TrendingDown, LogIn, LogOut, Activity, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePoll } from "@/hooks/use-server";
import { apiFetch } from "@/lib/client";

type BackupStatus = { running: boolean; lastRun: number | null; lastResult: string | null; nextRun: number | null; alerts?: { at: number; player: string; lost: number; units: number }[] };
type OpsResp = { settings: { restart: { enabled: boolean }; tps: { enabled: boolean; threshold: number } }; status: { lastTps: number | null; lastTpsAt: number | null; nextRestart: number | null } };
type Presence = { now: number; events: { at: number; player: string; type: "join" | "leave" }[] };

const hm = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const day = (t: number) => new Date(t).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });

function Tile({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "ok" | "warn" | "bad" }) {
  const c = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-chart-3" : "text-primary";
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground"><Icon className={`size-3.5 ${c}`} />{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// Portada: salud real del servidor (TPS, copias, reinicio), perdidas de objetos detectadas y actividad reciente
export function HomeHealth() {
  const { data: backup } = usePoll(() => apiFetch<BackupStatus>("/api/backup/status"), 30000);
  const { data: ops } = usePoll(() => apiFetch<OpsResp>("/api/ops"), 60000);
  const { data: presence } = usePoll(() => apiFetch<Presence>("/api/presence?hours=24"), 60000);

  const events = useMemo(() => [...(presence?.events ?? [])].sort((a, b) => b.at - a.at).slice(0, 8), [presence]);
  const alerts = backup?.alerts ?? [];
  const lastRun = backup?.lastRun ?? null;
  const now = presence?.now ?? 0; // hora del servidor (evita llamar a Date.now() en el render)
  const stale = !!backup?.running && !!lastRun && !!now && now - lastRun > 30 * 60000;
  const tps = ops?.status.lastTps;
  const tpsTone = tps == null ? undefined : tps >= 18 ? "ok" : tps >= (ops?.settings.tps.threshold ?? 15) ? "warn" : "bad";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="size-4 text-primary" />Salud y avisos</CardTitle>
          <CardDescription>Lo que el panel vigila por ti. Configurable en Ajustes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile icon={Gauge} label="TPS" tone={tpsTone} value={tps != null ? tps.toFixed(1) : "—"}
              sub={ops?.settings.tps.enabled ? (ops.status.lastTpsAt ? `leido a las ${hm(ops.status.lastTpsAt)}` : "esperando lectura") : <Link href="/settings" className="underline">Activar vigilancia</Link>} />
            <Tile icon={DatabaseBackup} label="Ultima copia" tone={!backup?.running ? "warn" : stale ? "bad" : "ok"}
              value={lastRun ? hm(lastRun) : "—"}
              sub={!backup?.running ? <Link href="/commands?tab=inv" className="underline">Copias desactivadas</Link> : stale ? "lleva mucho sin copiar" : backup?.lastResult ?? "al dia"} />
            <Tile icon={CalendarClock} label="Proximo reinicio" tone={ops?.status.nextRestart ? "ok" : "warn"}
              value={ops?.status.nextRestart ? day(ops.status.nextRestart) : "—"}
              sub={ops?.settings.restart.enabled ? "programado" : <Link href="/settings" className="underline">Sin programar</Link>} />
          </div>
          {alerts.length > 0 ? (
            <div className="space-y-1.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-destructive"><TrendingDown className="size-4" />Perdidas de objetos detectadas</p>
              {alerts.slice(0, 4).map((a, i) => (
                <Link key={i} href={`/commands?tab=inv&player=${encodeURIComponent(a.player)}&recover=1`} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-destructive/10">
                  <span className="font-mono text-xs text-muted-foreground">{hm(a.at)}</span>
                  <b>{a.player}</b><span className="text-muted-foreground">perdio {a.lost} objetos ({a.units} u.)</span>
                  <span className="ml-auto flex items-center gap-1 text-xs">Recuperar <ArrowUpRight className="size-3" /></span>
                </Link>
              ))}
            </div>
          ) : <p className="rounded-lg border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">Sin perdidas de objetos detectadas. Todo en orden.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actividad reciente</CardTitle>
          <CardDescription>Entradas y salidas de las ultimas 24 h</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {events.map((e, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md px-1 py-0.5">
                {e.type === "join" ? <LogIn className="size-3.5 text-primary" /> : <LogOut className="size-3.5 text-muted-foreground" />}
                <Link href={`/profile?player=${encodeURIComponent(e.player)}`} className="truncate hover:underline">{e.player}</Link>
                <Badge variant="outline" className="h-4 px-1 text-[9px]">{e.type === "join" ? "entro" : "salio"}</Badge>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">{hm(e.at)}</span>
              </li>
            ))}
            {events.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Sin actividad registrada.</p>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
