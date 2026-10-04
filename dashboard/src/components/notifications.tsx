"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, TrendingDown, Gauge, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePoll } from "@/hooks/use-server";
import { apiFetch } from "@/lib/client";

type Loss = { at: number; player: string; lost: number; units: number; names: string[] };
type BackupStatus = { lastRun: number | null; lastResult: string | null; running: boolean; alerts?: Loss[] };
type OpsResp = { status: { log: { at: number; text: string }[] } };
type Note = { id: string; at: number; icon: React.ElementType; text: string; href?: string };

const KEY = "exaroton.notif.seen";
const readSeen = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };

// Campana de avisos del panel: perdidas masivas de objetos, TPS bajo y reinicios programados
export function NotificationsBell() {
  const router = useRouter();
  const { data: backup } = usePoll(() => apiFetch<BackupStatus>("/api/backup/status"), 30000);
  const { data: ops } = usePoll(() => apiFetch<OpsResp>("/api/ops"), 60000);
  const [seen, setSeen] = useState(readSeen);

  const notes = useMemo<Note[]>(() => {
    const out: Note[] = [];
    for (const a of backup?.alerts ?? []) out.push({ id: `l${a.at}${a.player}`, at: a.at, icon: TrendingDown, text: `${a.player} perdio ${a.lost} objetos (${a.units} u.)`, href: `/commands?tab=inv&player=${encodeURIComponent(a.player)}&recover=1` });
    for (const l of ops?.status.log ?? []) out.push({ id: `o${l.at}`, at: l.at, icon: /TPS/i.test(l.text) ? Gauge : RefreshCw, text: l.text });
    return out.sort((a, b) => b.at - a.at).slice(0, 12);
  }, [backup, ops]);
  const unread = notes.filter((n) => n.at > seen).length;

  const markSeen = () => { const t = Date.now(); setSeen(t); try { localStorage.setItem(KEY, String(t)); } catch { /* sin almacenamiento */ } };

  return (
    <DropdownMenu onOpenChange={(o) => { if (!o && unread) markSeen(); }}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" title="Avisos" />}>
        <Bell />
        {unread > 0 && <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-destructive text-[9px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Avisos</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notes.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Sin avisos. Todo tranquilo.</p>}
          {notes.map((n) => (
            <DropdownMenuItem key={n.id} className="items-start gap-2" onClick={() => n.href && router.push(n.href)}>
              <n.icon className="mt-0.5 size-4 shrink-0 text-chart-3" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-tight">{n.text}</span>
                <span className="block text-[11px] text-muted-foreground">{new Date(n.at).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{n.href ? " · recuperar" : ""}</span>
              </span>
              {n.at > seen && <span className="mt-1 size-2 shrink-0 rounded-full bg-destructive" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
