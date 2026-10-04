"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, DatabaseBackup, Copy, Backpack, UserRound, Archive, Zap } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { NAV, COMMAND_TABS } from "@/components/nav";
import { useServer } from "@/hooks/use-server";
import { useMe } from "@/hooks/use-me";
import { apiFetch } from "@/lib/client";

type Entry = { id: string; group: string; label: string; hint?: string; icon: React.ElementType; run: () => void };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Paleta de comandos (Ctrl/Cmd+K o "/"): saltar a cualquier seccion, pestaña de Comandos o jugador, y acciones seguras
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { data: server } = useServer(0);
  const me = useMe();
  const [q, setQ] = useState("");
  const [cur, setCur] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const go = (url: string) => { onOpenChange(false); router.push(url); };

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const n of [...NAV, ...(me?.role === "admin" ? [{ href: "/admin", label: "Administracion", icon: UserRound }] : [])]) out.push({ id: "nav" + n.href, group: "Ir a", label: n.label, icon: n.icon, run: () => go(n.href) });
    for (const t of COMMAND_TABS) out.push({ id: "tab" + t.tab, group: "Comandos", label: t.label, hint: "/commands", icon: Zap, run: () => go(`/commands?tab=${t.tab}`) });
    for (const p of server?.players.list ?? []) {
      const e = encodeURIComponent(p);
      out.push({ id: "pf" + p, group: p, label: `Ficha de ${p}`, icon: UserRound, run: () => go(`/profile?player=${e}`) });
      out.push({ id: "pi" + p, group: p, label: `Inventario de ${p}`, icon: Backpack, run: () => go(`/commands?tab=inv&player=${e}`) });
      out.push({ id: "pr" + p, group: p, label: `Recuperar objetos de ${p}`, icon: Archive, run: () => go(`/commands?tab=inv&player=${e}&recover=1`) });
    }
    if (server?.address) out.push({ id: "copy", group: "Acciones", label: "Copiar direccion del servidor", hint: server.address, icon: Copy, run: () => { onOpenChange(false); navigator.clipboard.writeText(server.address).then(() => toast.success("Direccion copiada")); } });
    out.push({ id: "backup", group: "Acciones", label: "Copiar inventarios ahora", hint: "copia automatica manual", icon: DatabaseBackup, run: () => { onOpenChange(false); apiFetch<{ result: string }>("/api/backup/run", { method: "POST" }).then((r) => toast.success("Copia ejecutada", { description: r.result })).catch((e) => toast.error((e as Error).message)); } });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, me]);

  const shown = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return entries.filter((e) => e.group === "Ir a" || e.group === "Acciones");
    const words = n.split(/\s+/);
    return entries.filter((e) => { const t = norm(`${e.label} ${e.group} ${e.hint ?? ""}`); return words.every((w) => t.includes(w)); }).slice(0, 40);
  }, [entries, q]);

  const idx = Math.min(cur, Math.max(0, shown.length - 1));
  useEffect(() => { listRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: "nearest" }); }, [idx]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCur(Math.min(idx + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCur(Math.max(idx - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); shown[idx]?.run(); }
  };

  let lastGroup = "";
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setQ(""); setCur(0); } }}>
      <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="sr-only">Buscar</DialogTitle>
        <DialogDescription className="sr-only">Salta a una seccion, jugador o accion</DialogDescription>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setCur(0); }} onKeyDown={onKey} placeholder="Ir a… jugador, seccion, accion"
            className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <kbd className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <ul ref={listRef} className="max-h-80 overflow-auto p-1.5">
          {shown.map((e, i) => {
            const head = e.group !== lastGroup ? e.group : null;
            lastGroup = e.group;
            return (
              <li key={e.id}>
                {head && <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{head}</p>}
                <button data-i={i} onClick={e.run} onMouseMove={() => setCur(i)}
                  className={cn("flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm", i === idx ? "bg-primary/15 text-primary" : "hover:bg-muted")}>
                  <e.icon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{e.label}</span>
                  {e.hint && <span className="truncate font-mono text-[10px] text-muted-foreground">{e.hint}</span>}
                  {i === idx && <CornerDownLeft className="size-3.5 shrink-0 opacity-60" />}
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Sin resultados para “{q}”.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

// Atajo global: Ctrl/Cmd+K, o "/" fuera de cajas de texto
export function usePaletteShortcut(toggle: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); toggle(); }
      else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); toggle(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [toggle]);
}
