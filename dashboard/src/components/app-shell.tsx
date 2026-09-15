"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard, TerminalSquare, Zap, Settings2, Users, FolderTree, SlidersHorizontal, Server, ChevronDown, Check, Cpu, Menu,
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
import { apiFetch, setServerId, type ServerInfo } from "@/lib/client";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const NAV = [
  { href: "/", label: "Resumen", icon: LayoutDashboard },
  { href: "/console", label: "Consola", icon: TerminalSquare },
  { href: "/commands", label: "Comandos", icon: Zap },
  { href: "/config", label: "Configuracion", icon: Settings2 },
  { href: "/players", label: "Jugadores", icon: Users },
  { href: "/files", label: "Archivos", icon: FolderTree },
  { href: "/settings", label: "Ajustes", icon: SlidersHorizontal },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
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
      <div className="mt-auto rounded-lg border border-dashed p-3 text-[11px] leading-relaxed text-muted-foreground">
        El token de API vive solo en el servidor de Next.js. El navegador nunca lo ve.
      </div>
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
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
