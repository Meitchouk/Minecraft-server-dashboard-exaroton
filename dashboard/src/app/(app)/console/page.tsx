"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Send, Share2, ArrowDownToLine, Pause, Play, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/page-header";
import { usePoll, useServer } from "@/hooks/use-server";
import { apiFetch } from "@/lib/client";
import { cn } from "@/lib/utils";

const QUICK = [
  { label: "list", cmd: "list" },
  { label: "save-all", cmd: "save-all" },
  { label: "Dia", cmd: "time set day" },
  { label: "Noche", cmd: "time set night" },
  { label: "Despejar", cmd: "weather clear" },
  { label: "Lluvia", cmd: "weather rain" },
  { label: "TPS", cmd: "tps" },
  { label: "Anuncio", cmd: "say " },
];

function lineClass(l: string) {
  if (/\/(ERROR|FATAL)\]|Exception|error/i.test(l)) return "lvl-error";
  if (/\/WARN\]/i.test(l)) return "lvl-warn";
  return "lvl-info";
}

export default function ConsolePage() {
  const { data: server } = useServer(5000);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const [sending, setSending] = useState(false);
  const [follow, setFollow] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  const { data: logs, refresh, loading } = usePoll(
    () => apiFetch<{ content: string }>("/api/server/logs"),
    paused ? 0 : 4000,
    [paused],
  );

  const lines = useMemo(() => {
    const all = (logs?.content ?? "").split("\n").filter(Boolean);
    return filter ? all.filter((l) => l.toLowerCase().includes(filter.toLowerCase())) : all;
  }, [logs, filter]);

  useEffect(() => {
    if (follow && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines, follow]);

  const onScroll = () => {
    const el = boxRef.current; if (!el) return;
    setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  };

  const send = async (c = cmd) => {
    const command = c.trim();
    if (!command) return;
    if (server?.status !== 1) return toast.error("El servidor debe estar en linea para enviar comandos");
    setSending(true);
    try {
      await apiFetch("/api/server/command", { method: "POST", body: JSON.stringify({ command }) });
      setHistory((h) => [command, ...h.filter((x) => x !== command)].slice(0, 50));
      setHIdx(-1); setCmd("");
      setTimeout(refresh, 800);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSending(false); }
  };

  const share = async () => {
    const id = toast.loading("Subiendo log a mclo.gs…");
    try {
      const r = await apiFetch<{ url: string }>("/api/server/logs/share");
      await navigator.clipboard.writeText(r.url).catch(() => {});
      toast.success("Log compartido (URL copiada)", { id, description: r.url, action: { label: "Abrir", onClick: () => window.open(r.url, "_blank") } });
    } catch (e) { toast.error("No se pudo compartir", { id, description: (e as Error).message }); }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") send();
    else if (e.key === "ArrowUp") { e.preventDefault(); const i = Math.min(hIdx + 1, history.length - 1); if (history[i] !== undefined) { setHIdx(i); setCmd(history[i]); } }
    else if (e.key === "ArrowDown") { e.preventDefault(); const i = hIdx - 1; if (i < 0) { setHIdx(-1); setCmd(""); } else { setHIdx(i); setCmd(history[i]); } }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Consola" description="Log del servidor en vivo y envio de comandos.">
        <Tooltip><TooltipTrigger render={<Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)} />}>
          {paused ? <Play /> : <Pause />}{paused ? "Reanudar" : "Pausar"}
        </TooltipTrigger><TooltipContent>Pausar la actualizacion automatica</TooltipContent></Tooltip>
        <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className={cn(loading && "animate-spin")} />Actualizar</Button>
        <Button variant="outline" size="sm" onClick={share}><Share2 />Compartir log</Button>
      </PageHeader>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center gap-2 border-b py-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar lineas…" className="pl-8" />
          </div>
          <Badge variant="secondary" className="font-mono">{lines.length} lineas</Badge>
          {!follow && (
            <Button size="sm" variant="ghost" onClick={() => { setFollow(true); boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }); }}>
              <ArrowDownToLine />Ir al final
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div ref={boxRef} onScroll={onScroll}
            className="console-log h-[55vh] overflow-auto bg-black/50 px-4 py-3 font-mono text-[12.5px] leading-relaxed">
            {lines.length === 0 ? (
              <p className="text-muted-foreground">{loading ? "Cargando log…" : "Sin lineas (el servidor puede estar apagado)."}</p>
            ) : lines.map((l, i) => <div key={i} className={cn("whitespace-pre-wrap break-all", lineClass(l))}>{l}</div>)}
          </div>
        </CardContent>
        <div className="flex flex-col gap-2 border-t p-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-primary">/</span>
              <Input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={onKey}
                placeholder={server?.status === 1 ? "Escribe un comando y presiona Enter (↑↓ historial)" : "Servidor fuera de linea"}
                disabled={server?.status !== 1 || sending} className="pl-7 font-mono" />
            </div>
            <Button onClick={() => send()} disabled={server?.status !== 1 || sending || !cmd.trim()}><Send />Enviar</Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Rapidos:</span>
            {QUICK.map((q) => (
              <Button key={q.label} size="xs" variant="secondary" disabled={server?.status !== 1}
                onClick={() => q.cmd.endsWith(" ") ? setCmd(q.cmd) : send(q.cmd)}>{q.label}</Button>
            ))}
            {history.length > 0 && (
              <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setHistory([])}><Trash2 />Limpiar historial</Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
