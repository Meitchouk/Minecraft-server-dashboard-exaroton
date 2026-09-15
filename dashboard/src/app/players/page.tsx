"use client";
import { useState } from "react";
import { UserPlus, X, ShieldCheck, ListChecks, Ban, Network, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { usePoll, useServer } from "@/hooks/use-server";
import { apiFetch } from "@/lib/client";

const LISTS = [
  { id: "whitelist", label: "Whitelist", icon: ListChecks, desc: "Jugadores autorizados a entrar (si white-list esta activo)." },
  { id: "ops", label: "Operadores", icon: ShieldCheck, desc: "Jugadores con permisos de administrador." },
  { id: "banned-players", label: "Baneados", icon: Ban, desc: "Jugadores bloqueados por nombre." },
  { id: "banned-ips", label: "IPs baneadas", icon: Network, desc: "Direcciones IP bloqueadas." },
];

function Avatar({ name }: { name: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://mc-heads.net/avatar/${encodeURIComponent(name)}/28`} alt="" width={28} height={28} className="size-7 rounded" />;
}

function PlayerList({ list, online }: { list: string; online: string[] }) {
  const { data, loading, refresh, setData } = usePoll(() => apiFetch<string[]>(`/api/server/playerlists/${list}`), 15000, [list]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const isIp = list === "banned-ips";

  const add = async (names?: string[]) => {
    const entries = (names ?? input.split(/[\s,]+/)).map((s) => s.trim()).filter(Boolean);
    if (!entries.length) return;
    setBusy(true);
    try {
      const res = await apiFetch<string[]>(`/api/server/playerlists/${list}`, { method: "PUT", body: JSON.stringify({ entries }) });
      setData(res); setInput("");
      toast.success(`Agregado: ${entries.join(", ")}`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async (name: string) => {
    try {
      const res = await apiFetch<string[]>(`/api/server/playerlists/${list}`, { method: "DELETE", body: JSON.stringify({ entries: [name] }) });
      setData(res); toast.success(`${name} eliminado`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const candidates = online.filter((p) => !(data ?? []).includes(p));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={isIp ? "IP (ej. 203.0.113.5)" : "Nombre(s) separados por espacio o coma"} className="font-mono" />
        <Button onClick={() => add()} disabled={busy || !input.trim()}><UserPlus />Agregar</Button>
      </div>

      {!isIp && candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Zap className="size-3.5 text-primary" /> Conectados ahora:
          {candidates.map((p) => <Button key={p} size="xs" variant="secondary" onClick={() => add([p])}>+ {p}</Button>)}
        </div>
      )}

      {loading && !data ? <Skeleton className="h-32" /> : (data ?? []).length === 0 ? (
        <div className="grid place-items-center rounded-lg border border-dashed py-12 text-sm text-muted-foreground">Lista vacia</div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((name) => (
            <li key={name} className="group flex items-center gap-3 rounded-lg border bg-card/60 px-3 py-2">
              {!isIp && <Avatar name={name} />}
              <span className="min-w-0 flex-1 truncate font-mono text-sm">{name}</span>
              {online.includes(name) && <span className="size-2 rounded-full bg-primary" title="Conectado" />}
              <Button size="icon-xs" variant="ghost" className="opacity-60 group-hover:opacity-100" onClick={() => remove(name)} aria-label="Quitar"><X /></Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Los cambios se aplican en vivo a traves de la API de Exaroton. <button className="underline" onClick={refresh}>Recargar</button></p>
    </div>
  );
}

export default function PlayersPage() {
  const { data: server } = useServer(5000);
  const online = server?.players.list ?? [];
  const [tab, setTab] = useState("whitelist");
  const current = LISTS.find((l) => l.id === tab)!;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Jugadores" description="Whitelist, operadores y baneos.">
        <Badge variant="outline" className="gap-1.5"><Users className="size-3.5" />{online.length} en linea</Badge>
      </PageHeader>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="w-full sm:w-auto">
          {LISTS.map((l) => <TabsTrigger key={l.id} value={l.id} className="gap-1.5"><l.icon className="size-4" />{l.label}</TabsTrigger>)}
        </TabsList>
        {LISTS.map((l) => (
          <TabsContent key={l.id} value={l.id}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><current.icon className="size-4 text-primary" />{l.label}</CardTitle>
                <CardDescription>{l.desc}</CardDescription>
              </CardHeader>
              <CardContent>{tab === l.id && <PlayerList list={l.id} online={online} />}</CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
