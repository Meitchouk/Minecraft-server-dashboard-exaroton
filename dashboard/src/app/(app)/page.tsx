"use client";
import Link from "next/link";
import { useState } from "react";
import { Users, MemoryStick, Package, Globe, Copy, Check, Coins, TerminalSquare, Settings2, FolderTree, ArrowUpRight, Clock, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { ServerControls } from "@/components/server-controls";
import { usePoll, useServer } from "@/hooks/use-server";
import { apiFetch, motdToSpans } from "@/lib/client";

type Account = { name: string; email: string; verified: boolean; credits: number };

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button variant="ghost" size="icon-sm" onClick={async () => {
      await navigator.clipboard.writeText(text);
      setOk(true); toast.success("Direccion copiada"); setTimeout(() => setOk(false), 1500);
    }}>
      {ok ? <Check className="text-primary" /> : <Copy />}
    </Button>
  );
}

function Motd({ motd }: { motd: string }) {
  return (
    <span className="font-mono text-sm">
      {motdToSpans(motd).map((s, i) => s.text === "\n" ? <br key={i} /> :
        <span key={i} style={{ color: s.color, fontWeight: s.bold ? 700 : undefined, fontStyle: s.italic ? "italic" : undefined }}>{s.text}</span>)}
    </span>
  );
}

function Stat({ icon: Icon, label, value, sub, loading }: { icon: React.ElementType; label: string; value?: React.ReactNode; sub?: React.ReactNode; loading?: boolean }) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="mt-1.5 h-6 w-24" /> : <p className="mt-0.5 truncate text-xl font-semibold tabular-nums">{value}</p>}
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OverviewPage() {
  const { data: server, loading, error, refresh } = useServer(4000);
  const { data: ram } = usePoll(() => apiFetch<{ ram: number }>("/api/server/ram"), 30000);
  const { data: account } = usePoll(() => apiFetch<Account>("/api/account"), 60000);

  const online = server?.status === 1;
  const pct = server ? Math.round((server.players.count / Math.max(server.players.max, 1)) * 100) : 0;

  if (error && !server) {
    return (
      <Card className="border-destructive/40">
        <CardHeader><CardTitle>No se pudo conectar con la API</CardTitle><CardDescription>{error}</CardDescription></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Revisa que <code className="rounded bg-muted px-1">EXAROTON_TOKEN</code> este definido (variable de entorno o <code className="rounded bg-muted px-1">.env.local</code>) y reinicia <code className="rounded bg-muted px-1">npm run dev</code>.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {loading && !server ? <Skeleton className="h-8 w-48" /> : <h1 className="text-3xl font-semibold tracking-tight">{server?.name}</h1>}
              <StatusBadge status={server?.status} size="lg" />
            </div>
            {server && (
              <>
                <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
                  <Globe className="size-4" />
                  <span className="font-mono text-sm">{server.address}</span>
                  <CopyButton text={server.address} />
                  {server.host && server.port && <Badge variant="secondary" className="ml-1 font-mono text-[11px]">{server.host}:{server.port}</Badge>}
                </div>
                <div className="rounded-lg border bg-black/40 px-3 py-2"><Motd motd={server.motd} /></div>
              </>
            )}
          </div>
          <div className="shrink-0"><ServerControls status={server?.status} onDone={refresh} size="lg" /></div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Jugadores" loading={!server}
          value={server ? `${server.players.count} / ${server.players.max}` : undefined}
          sub={<Progress value={pct} className="mt-2 h-1.5" />} />
        <Stat icon={MemoryStick} label="RAM asignada" loading={!ram} value={ram ? `${ram.ram} GB` : undefined}
          sub={<Link href="/settings" className="inline-flex items-center gap-1 hover:text-foreground">Cambiar <ArrowUpRight className="size-3" /></Link>} />
        <Stat icon={Package} label="Software" loading={!server}
          value={server?.software?.name ?? "—"} sub={server?.software?.version} />
        <Stat icon={Coins} label="Creditos" loading={!account}
          value={account ? account.credits.toFixed(2) : undefined}
          sub={account ? account.name : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Players list */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="size-4 text-primary" /> Jugadores conectados</CardTitle>
            <CardDescription>{online ? "Actualizado cada 4 s" : "El servidor no esta en linea"}</CardDescription>
          </CardHeader>
          <CardContent>
            {!server ? <Skeleton className="h-16 w-full" /> : server.players.list.length === 0 ? (
              <div className="grid place-items-center rounded-lg border border-dashed py-10 text-sm text-muted-foreground">
                {online ? "Nadie conectado ahora mismo" : "Inicia el servidor para ver jugadores"}
              </div>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {server.players.list.map((p) => (
                  <li key={p} className="flex items-center gap-3 rounded-lg border bg-card/60 px-3 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://mc-heads.net/avatar/${encodeURIComponent(p)}/32`} alt="" width={32} height={32} className="size-8 rounded" />
                    <span className="font-medium">{p}</span>
                    <Button size="xs" variant="ghost" className="ml-auto"
                      onClick={() => apiFetch("/api/server/command", { method: "POST", body: JSON.stringify({ command: `kick ${p}` }) })
                        .then(() => toast.success(`${p} expulsado`)).catch((e) => toast.error(e.message))}>
                      Kick
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader><CardTitle>Accesos rapidos</CardTitle><CardDescription>Lo mas usado</CardDescription></CardHeader>
          <CardContent className="grid gap-2">
            {[
              { href: "/console", icon: TerminalSquare, label: "Abrir consola", desc: "Logs y comandos" },
              { href: "/commands", icon: Zap, label: "Comandos rapidos", desc: "Give, efectos, clima, gamemode…" },
              { href: "/config", icon: Settings2, label: "server.properties", desc: "Dificultad, modo, whitelist…" },
              { href: "/files", icon: FolderTree, label: "Explorar archivos", desc: "Mods, configs, mundo" },
              { href: "/settings", icon: Clock, label: "RAM y MOTD", desc: "Ajustes del servidor" },
            ].map(({ href, icon: Icon, label, desc }) => (
              <Link key={href} href={href} className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5">
                <Icon className="size-4 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{desc}</span>
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
