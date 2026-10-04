"use client";
import { useMemo, useState } from "react";
import { useQueryText } from "@/hooks/use-query-state";
import { Puzzle, Search, Power, PowerOff, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ReadOnlyNotice } from "@/components/admin-only";
import { usePermissions } from "@/hooks/use-permissions";
import { usePoll } from "@/hooks/use-server";
import { apiFetch, formatBytes } from "@/lib/client";

type Mod = { name: string; size: number };
type Data = { enabled: Mod[]; disabled: Mod[] };

// "sodium-fabric-0.5.8+mc1.21.jar" -> "sodium": nombre base sin version, para detectar mods repetidos
const baseOf = (n: string) => n.replace(/\.jar$/i, "").toLowerCase().replace(/[-_ +]?(fabric|forge|neoforge|quilt|mc)?[-_ +]?v?\d[\w.+-]*$/i, "").replace(/[-_ ]+(fabric|forge|neoforge|quilt|universal)$/i, "");

export default function ModsPage() {
  const { data, loading, refresh } = usePoll(() => apiFetch<Data>("/api/mods"), 0);
  const [q, setQ] = useQueryText("q");
  const [busy, setBusy] = useState<string | null>(null);
  const perms = usePermissions();
  const can = perms.can("files.write");

  const dupes = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const x of data?.enabled ?? []) { const b = baseOf(x.name); m.set(b, [...(m.get(b) ?? []), x.name]); }
    return [...m.values()].filter((l) => l.length > 1);
  }, [data]);

  const move = async (name: string, action: "disable" | "enable") => {
    setBusy(name);
    try { await apiFetch("/api/mods", { method: "POST", body: JSON.stringify({ name, action }) }); toast.success(action === "disable" ? `${name} desactivado` : `${name} activado`, { description: "Se aplica al reiniciar el servidor." }); refresh(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const n = q.trim().toLowerCase();
  const match = (m: Mod) => !n || m.name.toLowerCase().includes(n);
  const enabled = (data?.enabled ?? []).filter(match);
  const disabled = (data?.disabled ?? []).filter(match);

  const row = (m: Mod, on: boolean) => (
    <li key={m.name} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
      <span className="min-w-0 flex-1 truncate font-mono" title={m.name}>{m.name}</span>
      <span className="shrink-0 text-muted-foreground">{formatBytes(m.size)}</span>
      <Button size="xs" variant="outline" disabled={!can || busy !== null} onClick={() => move(m.name, on ? "disable" : "enable")}>
        {busy === m.name ? <Loader2 className="animate-spin" /> : on ? <PowerOff /> : <Power />}{on ? "Desactivar" : "Activar"}
      </Button>
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Mods" description="Lista de mods del servidor. Desactivar un mod lo mueve a mods-disabled (no se borra); se aplica al reiniciar." />
      {perms.ready && !can && <ReadOnlyNotice what="activar o desactivar mods" />}
      <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar mod…" className="h-8 pl-8 text-xs" /></div>
      {dupes.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-chart-3/30 bg-chart-3/10 px-3 py-2 text-xs text-chart-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div><p className="font-medium">Posibles mods repetidos (misma base, distinta version)</p>{dupes.map((l, i) => <p key={i} className="font-mono">{l.join("  ·  ")}</p>)}</div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Puzzle className="size-4 text-primary" />Activos <Badge variant="secondary" className="h-4 px-1 text-[10px]">{data?.enabled.length ?? 0}</Badge></CardTitle>
            <CardDescription>Carpeta <code className="rounded bg-muted px-1">mods</code>.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !data ? <p className="py-4 text-center text-xs text-muted-foreground">Cargando…</p> : <ul className="max-h-[70vh] space-y-1 overflow-auto pr-1">{enabled.map((m) => row(m, true))}{enabled.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Nada que mostrar.</p>}</ul>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><PowerOff className="size-4 text-muted-foreground" />Desactivados <Badge variant="secondary" className="h-4 px-1 text-[10px]">{data?.disabled.length ?? 0}</Badge></CardTitle>
            <CardDescription>Carpeta <code className="rounded bg-muted px-1">mods-disabled</code>.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="max-h-[70vh] space-y-1 overflow-auto pr-1">{disabled.map((m) => row(m, false))}{disabled.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Ninguno.</p>}</ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
