"use client";
import { useMemo, useState } from "react";
import { BarChart3, Clock, Skull, Swords, Pickaxe, Footprints, Gem, RefreshCw, Users, LogIn, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { usePoll } from "@/hooks/use-server";
import { apiFetch } from "@/lib/client";
import { useCatalog, label } from "@/hooks/use-catalog";
import { cn } from "@/lib/utils";

type PlayerStats = {
  uuid: string; name: string; playTimeMin: number; deaths: number; playerKills: number; mobKills: number; damageTaken: number; damageDealt: number;
  walkedKm: number; jumps: number; sleeps: number; sinceDeathMin: number; minedTotal: number; diamonds: number;
  topMined: { id: string; value: number }[]; topKilled: { id: string; value: number }[]; topUsed: { id: string; value: number }[];
};
type Presence = { now: number; events: { at: number; player: string; type: "join" | "leave" }[]; samples: { at: number; count: number; players: string[]; online: boolean }[] };

const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);
const fmtT = (t: number) => new Date(t).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Grafica de jugadores conectados: una serie, un color, barras finas por intervalo, tooltip al pasar el raton
function OnlineChart({ samples, hours, now }: { samples: Presence["samples"]; hours: number; now: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const buckets = useMemo(() => {
    const n = hours <= 24 ? 48 : hours <= 168 ? 84 : 120; // 30 min / 2 h / 6 h
    const from = now - hours * 3600000, w = (now - from) / n;
    const out = Array.from({ length: n }, (_, i) => ({ from: from + i * w, to: from + (i + 1) * w, max: 0, players: new Set<string>(), has: false }));
    for (const s of samples) { const i = Math.min(n - 1, Math.max(0, Math.floor((s.at - from) / w))); const b = out[i]; b.has = true; b.max = Math.max(b.max, s.count); s.players.forEach((p) => b.players.add(p)); }
    return out;
  }, [samples, hours, now]);
  const peak = Math.max(1, ...buckets.map((b) => b.max));
  const W = 900, H = 160, padL = 28, padB = 22, padT = 8;
  const bw = (W - padL) / buckets.length;
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / peak);
  const ticks = [0, Math.ceil(peak / 2), peak].filter((v, i, a) => a.indexOf(v) === i);
  const h = hover !== null ? buckets[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.08} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.55}>{t}</text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const x = padL + i * bw + 1, bh = Math.max(b.has && b.max > 0 ? 2 : 0, y(0) - y(b.max));
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={x - 1} y={padT} width={bw} height={H - padB - padT} fill="transparent" />
              {b.has && <rect x={x} y={y(0) - bh} width={Math.max(1, bw - 2)} height={bh} rx={2} className={cn("fill-primary transition-opacity", hover !== null && hover !== i && "opacity-50")} />}
              {b.has && b.max === 0 && <rect x={x} y={y(0) - 1} width={Math.max(1, bw - 2)} height={1} className="fill-muted-foreground/40" />}
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => { const b = buckets[Math.min(buckets.length - 1, Math.floor(f * (buckets.length - 1)))]; return <text key={f} x={padL + f * (W - padL - bw) + bw / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.55}>{new Date(b.from).toLocaleString([], hours <= 24 ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", hour: "2-digit" })}</text>; })}
      </svg>
      {h && h.has && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow">
          <b>{h.max}</b> jugador(es) · {fmtT(h.from)} – {new Date(h.to).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {h.players.size > 0 && <span className="block font-mono text-muted-foreground">{[...h.players].join(", ")}</span>}
        </div>
      )}
      {samples.length === 0 && <p className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Aun no hay muestras (se toma una cada 5 min mientras el panel esta encendido).</p>}
    </div>
  );
}

export default function StatsPage() {
  const { data: stats, loading, refresh } = usePoll(() => apiFetch<PlayerStats[]>("/api/stats"), 120000);
  const [hours, setHours] = useState(24);
  const { data: presence, loading: pLoading } = usePoll(() => apiFetch<Presence>(`/api/presence?hours=${hours}`), 60000, [hours]);
  const now = presence?.now ?? 0;
  const { data: catalog } = useCatalog();
  const [sel, setSel] = useState<string | null>(null);
  const nameOf = (id: string) => { const it = catalog?.items.find((i) => i.name === id); const en = catalog?.entities.find((e) => e.name === id); return it ? label(it) : en ? label(en) : id; };

  const totals = useMemo(() => ({ play: (stats ?? []).reduce((a, p) => a + p.playTimeMin, 0), deaths: (stats ?? []).reduce((a, p) => a + p.deaths, 0), mined: (stats ?? []).reduce((a, p) => a + p.minedTotal, 0) }), [stats]);
  const current = (stats ?? []).find((p) => p.uuid === sel) ?? stats?.[0];

  // sesiones (entrada -> salida) a partir de los eventos
  const sessions = useMemo(() => {
    const ev = [...(presence?.events ?? [])].sort((a, b) => a.at - b.at);
    const open: Record<string, number> = {}; const out: { player: string; from: number; to: number | null }[] = [];
    for (const e of ev) { if (e.type === "join") open[e.player] = e.at; else if (open[e.player]) { out.push({ player: e.player, from: open[e.player], to: e.at }); delete open[e.player]; } }
    for (const [player, from] of Object.entries(open)) out.push({ player, from, to: null });
    return out.sort((a, b) => b.from - a.from).slice(0, 40);
  }, [presence]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Estadisticas" description="Datos reales del juego (world/stats) y del historial de conexiones que registra el panel.">
        <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className={cn(loading && "animate-spin")} />Actualizar</Button>
      </PageHeader>

      {/* Resumen */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[{ i: Clock, l: "Tiempo jugado total", v: hm(totals.play) }, { i: Skull, l: "Muertes totales", v: totals.deaths }, { i: Pickaxe, l: "Bloques minados", v: totals.mined.toLocaleString() }].map((t) => (
          <Card key={t.l}><CardContent className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><t.i className="size-4" /></span><div><p className="text-xs uppercase tracking-wider text-muted-foreground">{t.l}</p><p className="text-lg font-semibold tabular-nums">{loading && !stats ? "…" : t.v}</p></div></CardContent></Card>
        ))}
      </div>

      {/* Historial de conexiones */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2"><Users className="size-4 text-primary" />Jugadores conectados</CardTitle>
            <CardDescription>Maximo de jugadores por intervalo. Pasa el raton para ver quienes estaban.</CardDescription>
          </div>
          <Tabs value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
            <TabsList>{[[24, "24 h"], [168, "7 dias"], [720, "30 dias"]].map(([h, l]) => <TabsTrigger key={h} value={String(h)}>{l}</TabsTrigger>)}</TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-4">
          {pLoading && !presence ? <Skeleton className="h-44" /> : <OnlineChart samples={presence?.samples ?? []} hours={hours} now={now} />}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Ultimas sesiones</p>
            {sessions.length === 0 ? <p className="text-xs text-muted-foreground">Sin entradas registradas en este periodo.</p> : (
              <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {sessions.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://mc-heads.net/avatar/${encodeURIComponent(s.player)}/20`} alt="" className="size-5 rounded" />
                    <span className="font-medium">{s.player}</span>
                    <span className="ml-auto flex items-center gap-1 text-muted-foreground"><LogIn className="size-3" />{fmtT(s.from)}{s.to ? <><LogOut className="ml-1 size-3" />{new Date(s.to).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</> : <Badge className="ml-1 h-4 px-1 text-[9px]">en linea</Badge>}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ranking + detalle */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="size-4 text-primary" />Jugadores</CardTitle><CardDescription>Ordenados por tiempo jugado. Se actualiza cuando el servidor guarda.</CardDescription></CardHeader>
          <CardContent>
            {loading && !stats ? <Skeleton className="h-48" /> : (
              <ul className="space-y-1.5">
                {(stats ?? []).map((p, i) => (
                  <li key={p.uuid}>
                    <button onClick={() => setSel(p.uuid)} className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/50", current?.uuid === p.uuid && "border-primary/40 bg-primary/5")}>
                      <span className="w-5 text-center font-mono text-xs text-muted-foreground">{i + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://mc-heads.net/avatar/${encodeURIComponent(p.name)}/28`} alt="" className="size-7 rounded" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.name}</span><span className="block text-[11px] text-muted-foreground">{hm(p.playTimeMin)} · {p.deaths} muertes · {p.playerKills} kills</span></span>
                    </button>
                  </li>
                ))}
                {stats && stats.length === 0 && <li className="py-6 text-center text-xs text-muted-foreground">Sin archivos de estadisticas todavia.</li>}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          {current ? (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://mc-heads.net/avatar/${encodeURIComponent(current.name)}/32`} alt="" className="size-8 rounded" />{current.name}
                </CardTitle>
                <CardDescription>Sin morir desde hace {hm(current.sinceDeathMin)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[{ i: Clock, l: "Jugado", v: hm(current.playTimeMin) }, { i: Skull, l: "Muertes", v: current.deaths }, { i: Swords, l: "Kills PvP / mobs", v: `${current.playerKills} / ${current.mobKills}` }, { i: Pickaxe, l: "Bloques minados", v: current.minedTotal.toLocaleString() }, { i: Gem, l: "Diamantes", v: current.diamonds }, { i: Footprints, l: "Recorrido", v: `${current.walkedKm} km` }, { i: Swords, l: "Daño hecho / recibido", v: `${current.damageDealt} / ${current.damageTaken}` }, { i: Clock, l: "Noches dormidas", v: current.sleeps }].map((t) => (
                    <div key={t.l} className="rounded-lg border px-3 py-2"><p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground"><t.i className="size-3" />{t.l}</p><p className="text-base font-semibold tabular-nums">{t.v}</p></div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[{ t: "Mas minado", d: current.topMined }, { t: "Mas matado", d: current.topKilled }, { t: "Mas usado", d: current.topUsed }].map((b) => (
                    <div key={b.t}>
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{b.t}</p>
                      <ul className="space-y-1 text-xs">{b.d.length === 0 ? <li className="text-muted-foreground">—</li> : b.d.map((x) => <li key={x.id} className="flex justify-between gap-2 rounded-md border px-2 py-1"><span className="truncate">{nameOf(x.id)}</span><span className="font-mono text-muted-foreground">{x.value.toLocaleString()}</span></li>)}</ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </>
          ) : <CardContent className="grid h-full place-items-center py-16 text-sm text-muted-foreground">Selecciona un jugador</CardContent>}
        </Card>
      </div>
    </div>
  );
}
