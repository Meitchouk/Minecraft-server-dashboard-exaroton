"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard, TerminalSquare, Zap, Gavel, MessageSquareHeart, BarChart3, Settings2, Users, FolderTree, SlidersHorizontal, Server, ChevronDown, Check, Cpu, Menu, ShieldCheck, LogOut, KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { ServerControls } from "@/components/server-controls";
import { usePoll, useServer, useServerId } from "@/hooks/use-server";
import { apiFetch, setServerId, getOwnToken, setOwnToken, type ServerInfo } from "@/lib/client";
import { useMe } from "@/hooks/use-me";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const NAV = [
  { href: "/", label: "Resumen", icon: LayoutDashboard },
  { href: "/console", label: "Consola", icon: TerminalSquare },
  { href: "/commands", label: "Comandos", icon: Zap },
  { href: "/discipline", label: "Castigos y premios", icon: Gavel },
  { href: "/messages", label: "Mensajes", icon: MessageSquareHeart },
  { href: "/stats", label: "Estadisticas", icon: BarChart3 },
  { href: "/config", label: "Configuracion", icon: Settings2 },
  { href: "/players", label: "Jugadores", icon: Users },
  { href: "/files", label: "Archivos", icon: FolderTree },
  { href: "/settings", label: "Ajustes", icon: SlidersHorizontal },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const me = useMe();
  const items = me?.role === "admin" ? [...NAV, { href: "/admin", label: "Administracion", icon: ShieldCheck }] : NAV;
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-sidebar-accent text-sidebar-foreground font-medium" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}>
            <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function ServerSwitcher() {
  const current = useServerId();
  const { data: servers } = usePoll(() => apiFetch<ServerInfo[]>("/api/servers"), 30000);
  const { data: server } = useServer(5000);

  // Si no hay servidor guardado, adopta el que devuelve el backend (.env)
  useEffect(() => {
    if (!current && server?.id) setServerId(server.id);
  }, [current, server?.id]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="w-full justify-between h-auto py-2" />}
      >
        <span className="flex items-center gap-2.5 text-left min-w-0">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
            <Server className="size-4" />
          </span>
          <span className="min-w-0">
            {server ? (
              <>
                <span className="block truncate text-sm font-medium leading-tight">{server.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground leading-tight">{server.address}</span>
              </>
            ) : (
              <><Skeleton className="h-3.5 w-24 mb-1" /><Skeleton className="h-2.5 w-32" /></>
            )}
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
        <DropdownMenuLabel>Servidores</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(servers ?? []).map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => setServerId(s.id)} className="gap-2">
            <StatusDot status={s.status} />
            <span className="flex-1 truncate">{s.name}</span>
            {s.id === (current || server?.id) && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusDot({ status }: { status: number }) {
  const color = status === 1 ? "bg-primary" : status === 0 ? "bg-muted-foreground" : status === 7 ? "bg-destructive" : "bg-chart-3";
  return <span className={cn("size-2 rounded-full shrink-0", color)} />;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/" className="flex items-center gap-2.5 px-1" onClick={onNavigate}>
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)]">
          <Cpu className="size-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold leading-tight tracking-tight">Exaroton Panel</span>
          <span className="block text-[11px] text-muted-foreground leading-tight">control de servidor</span>
        </span>
      </Link>
      <ServerSwitcher />
      <NavLinks onNavigate={onNavigate} />
      <UserBox />
    </div>
  );
}

function TopBar() {
  const { data: server, refresh } = useServer(5000);
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <Dialog>
        <DialogTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
          <Menu />
        </DialogTrigger>
        <DialogContent className="left-0 top-0 h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-r p-0 bg-sidebar" showCloseButton={false}>
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <SidebarContent />
        </DialogContent>
      </Dialog>
      <div className="flex items-center gap-3 min-w-0">
        <StatusBadge status={server?.status} />
        {server && (
          <Badge variant="outline" className="hidden sm:inline-flex font-mono text-[11px]">
            {server.players.count}/{server.players.max} jugadores
          </Badge>
        )}
      </div>
      <div className="ml-auto">
        <ServerControls status={server?.status} onDone={refresh} size="sm" />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">
        <div className="sticky top-0 h-dvh"><SidebarContent /></div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="grid-bg flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-6xl"><PendingBanner />{children}</div>
        </main>
      </div>
    </div>
  );
}

const subOwn = (cb: () => void) => { window.addEventListener("exaroton:server-changed", cb); return () => window.removeEventListener("exaroton:server-changed", cb); };

function UserBox() {
  const me = useMe();
  const router = useRouter();
  const own = useSyncExternalStore(subOwn, () => !!getOwnToken(), () => false);
  const logout = async () => { await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {}); setOwnToken(""); router.replace("/login"); router.refresh(); };
  return (
    <div className="mt-auto space-y-2">
      {own && (
        <div className="flex items-start gap-2 rounded-lg border border-chart-3/40 bg-chart-3/10 p-2.5 text-[11px] leading-snug text-chart-3">
          <KeyRound className="mt-0.5 size-3.5 shrink-0" />
          <span>Usando <b>tu propia API key</b> (solo en esta pestaña). <button className="underline" onClick={() => setOwnToken("")}>Dejar de usarla</button></span>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-lg border p-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{(me?.username ?? "?").slice(0, 1).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{me?.username ?? "…"}</span>
          <span className="block text-[11px] text-muted-foreground">{me?.role === "admin" ? "administrador" : "usuario"}</span>
        </span>
        <Button size="icon-sm" variant="ghost" onClick={logout} title="Cerrar sesion"><LogOut /></Button>
      </div>
    </div>
  );
}

function PendingBanner() {
  const me = useMe();
  const own = useSyncExternalStore(subOwn, () => !!getOwnToken(), () => false);
  if (!me || me.approved || own) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-chart-3/40 bg-chart-3/10 px-4 py-3 text-sm text-chart-3">
      <ShieldCheck className="size-4 shrink-0" />
      <span className="flex-1">Tu cuenta esta <b>pendiente de aprobacion</b>: aun no puedes usar el servidor del administrador. Mientras tanto puedes operar tus propios servidores con tu API key.</span>
      <Link href="/settings" className="rounded-md border border-chart-3/50 px-2.5 py-1 text-xs font-medium hover:bg-chart-3/20">Usar mi API key</Link>
    </div>
  );
}
