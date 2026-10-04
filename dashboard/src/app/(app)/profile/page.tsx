"use client";
import { useMemo, useState } from "react";
import { UserRound, Clock, Skull, Swords, Footprints, Pickaxe, History, Backpack, ScrollText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { usePoll, useServer } from "@/hooks/use-server";
import { useModCatalog } from "@/hooks/use-mod-catalog";
import { useCatalog } from "@/hooks/use-catalog";
import { apiFetch } from "@/lib/client";
import type { InvSlot } from "@/lib/snbt";
import { ItemIcon, lookupFor } from "../commands/item-visuals";

type PlayerStats = {
  uuid: string; name: string; playTimeMin: number; deaths: number; playerKills: number; mobKills: number; walkedKm: number; minedTotal: number; diamonds: number; sinceDeathMin: number;
  topMined: { id: string; value: number }[]; topKilled: { id: string; value: number }[];
};
type Presence = { now: number; events: { at: number; player: string; type: "join" | "leave" }[] };
type Audit = { at: number; kind: string; command: string; source?: string; result?: string };

const dur = (min: number) => min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
const pretty = (id: string) => id.replace(/^minecraft:/, "").replace(/_/g, " ");

// Ficha unificada: estadisticas, ultima copia de inventario, sesiones recientes y acciones del panel sobre el jugador
export default function ProfilePage() {
  const { data: server } = useServer(8000);
  const { data: stats } = usePoll(() => apiFetch<PlayerStats[]>("/api/stats"), 0);
  const { data: presence } = usePoll(() => apiFetch<Presence>("/api/presence?hours=720"), 0);
  const { data: modCat } = useModCatalog();
  const { data: catalog } = useCatalog();
  const look = useMemo(() => lookupFor(modCat), [modCat]);
  const version = catalog?.version ?? "1.21";
  const [pick, setPick] = useState<string>("");

  const online = useMemo(() => server?.players.list ?? [], [server]);
  const names = useMemo(() => [...new Set([...online, ...(stats ?? []).map((s) => s.name)])].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })), [online, stats]);
  const who = pick || names[0] || "";
  const st = stats?.find((s) => s.name.toLowerCase() === who.toLowerCase());
  const isOn = online.some((p) => p.toLowerCase() === who.toLowerCase());

  const { data: snaps } = usePoll(() => who ? apiFetch<{ snapshots: { at: number; items: InvSlot[]; ender: InvSlot[] }[] }>(`/api/backup/snapshots?player=${encodeURIComponent(who)}&limit=1`) : Promise.resolve(null), 0, [who]);
  const { data: audit } = usePoll(() => who ? apiFetch<Audit[]>(`/api/audit?text=${encodeURIComponent(who)}&limit=15`) : Promise.resolve(null), 0, [who]);
  const snap = snaps?.snapshots?.[0];

  const sessions = useMemo(() => {
    const out: { from: number; to: number | null }[] = [];
    let open: number | null = null;
    for (const e of [...(presence?.events ?? [])].filter((x) => x.player.toLowerCase() === who.toLowerCase()).sort((a, b) => a.at - b.at)) {
      if (e.type === "join") open = e.at; else if (open != null) { out.push({ from: open, to: e.at }); open = null; }
    }
    if (open != null && isOn) out.push({ from: open, to: null });
    return out.reverse().slice(0, 8);
  }, [presence, who, isOn]);
  const totalMin = sessions.reduce((a, s) => a + (s.to ? Math.round((s.to - s.from) / 60000) : 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Ficha de jugador" description="Todo de un jugador en una pantalla: estadisticas, ultimo inventario guardado, sesiones y acciones del panel." />
      <div className="flex flex-wrap gap-1.5">
        {names.map((n) => (
          <Button key={n} size="xs" variant={n.toLowerCase() === who.toLowerCase() ? "default" : "outline"} onClick={() => setPick(n)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://mc-heads.net/avatar/${encodeURIComponent(n)}/16`} alt="" width={14} height={14} className="size-3.5 rounded-[2px]" />{n}
            {online.some((p) => p.toLowerCase() === n.toLowerCase()) && <span className="size-1.5 rounded-full bg-primary" />}
          </Button>
        ))}
        {names.length === 0 && <p className="text-sm text-muted-foreground">Aun no hay jugadores registrados.</p>}
      </div>

      {who && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://mc-heads.net/head/${encodeURIComponent(who)}/48`} alt="" width={40} height={40} className="size-10 rounded-md" />
                <span>{who}</span>
                <Badge variant={isOn ? "default" : "secondary"} className="ml-auto">{isOn ? "en linea" : "desconectado"}</Badge>
              </CardTitle>
              <CardDescription>{st ? `${dur(st.playTimeMin)} jugadas en total` : "Sin estadisticas guardadas todavia"}</CardDescription>
            </CardHeader>
            {st && (
              <CardContent className="grid grid-cols-2 gap-2 text-sm">
                {([[Skull, "Muertes", st.deaths], [Swords, "Mobs", st.mobKills], [UserRound, "Jugadores", st.playerKills], [Footprints, "Km", st.walkedKm], [Pickaxe, "Bloques", st.minedTotal], [Clock, "Desde su muerte", dur(st.sinceDeathMin)]] as const).map(([I, l, v]) => (
                  <div key={l} className="rounded-lg border px-2 py-1.5"><p className="flex items-center gap-1 text-[11px] text-muted-foreground"><I className="size-3" />{l}</p><p className="font-mono">{typeof v === "number" ? v.toLocaleString() : v}</p></div>
                ))}
                {st.topMined.length > 0 && <p className="col-span-2 text-xs text-muted-foreground">Mas minado: {st.topMined.slice(0, 3).map((m) => `${pretty(m.id)} (${m.value.toLocaleString()})`).join(", ")}</p>}
                {st.topKilled.length > 0 && <p className="col-span-2 text-xs text-muted-foreground">Mas matado: {st.topKilled.slice(0, 3).map((m) => `${pretty(m.id)} (${m.value})`).join(", ")}</p>}
              </CardContent>
            )}
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Backpack className="size-4 text-primary" />Ultimo inventario guardado</CardTitle>
              <CardDescription>{snap ? `${new Date(snap.at).toLocaleString()} · ${snap.items.length} objetos${snap.ender.length ? ` · cofre de Ender: ${snap.ender.length}` : ""}. Para devolver objetos: Comandos → Inventario → Recuperar.` : "Aun no hay copias de este jugador."}</CardDescription>
            </CardHeader>
            {snap && (
              <CardContent className="flex flex-wrap gap-1.5">
                {[...snap.items].sort((a, b) => a.id.localeCompare(b.id)).map((i, n) => (
                  <span key={n} className="relative" title={`${i.name ?? i.id.replace(/^[^:]*:/, "")} x${i.count}`}>
                    <ItemIcon id={i.id} version={version} look={look} className="size-9" fallback={i.id} />
                    {i.count > 1 && <span className="absolute -bottom-1 -right-0.5 rounded bg-background/80 px-0.5 font-mono text-[9px]">{i.count}</span>}
                  </span>
                ))}
              </CardContent>
            )}
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><History className="size-4 text-primary" />Sesiones recientes</CardTitle>
              <CardDescription>Ultimos 30 dias · {dur(totalMin)} en las sesiones listadas</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-xs">
                {sessions.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-md border px-2 py-1">
                    <span>{new Date(s.from).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="ml-auto font-mono text-muted-foreground">{s.to ? dur(Math.round((s.to - s.from) / 60000)) : "en curso"}</span>
                  </li>
                ))}
                {sessions.length === 0 && <p className="py-3 text-center text-muted-foreground">Sin sesiones registradas.</p>}
              </ul>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ScrollText className="size-4 text-primary" />Acciones del panel sobre {who}</CardTitle>
              <CardDescription>Comandos ejecutados desde el panel que mencionan al jugador.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="max-h-64 space-y-1 overflow-auto font-mono text-xs">
                {(audit ?? []).map((a, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="shrink-0 text-muted-foreground">{new Date(a.at).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="truncate" title={a.command}>/{a.command}</span>
                    {a.source && <Badge variant="outline" className="ml-auto h-4 shrink-0 px-1 text-[9px]">{a.source}</Badge>}
                  </li>
                ))}
                {(audit ?? []).length === 0 && <p className="py-3 text-center font-sans text-muted-foreground">Nada registrado.</p>}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
