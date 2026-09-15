"use client";
import { useState } from "react";
import { Play, Square, RotateCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/client";

type Action = "start" | "stop" | "restart";

export function ServerControls({ status, onDone, size = "default" }: { status?: number; onDone?: () => void; size?: "sm" | "default" | "lg" }) {
  const [busy, setBusy] = useState<Action | null>(null);
  const online = status === 1;
  const offline = status === 0 || status === 7;
  const transitional = status !== undefined && !online && !offline;

  const run = async (action: Action) => {
    setBusy(action);
    const labels = { start: "Iniciando servidor…", stop: "Deteniendo servidor…", restart: "Reiniciando servidor…" };
    const id = toast.loading(labels[action]);
    try {
      await apiFetch("/api/server/action", { method: "POST", body: JSON.stringify({ action }) });
      toast.success("Orden enviada", { id, description: "El estado se actualizara en unos segundos." });
      onDone?.();
    } catch (e) {
      toast.error("No se pudo ejecutar", { id, description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size={size} onClick={() => run("start")} disabled={!offline || busy !== null || transitional} className="glow-primary">
        {busy === "start" ? <Loader2 className="animate-spin" /> : <Play />}
        Iniciar
      </Button>
      <Confirm online={online} busy={busy} run={run} size={size} action="restart" label="Reiniciar" variant="outline" icon={<RotateCw />}
        desc="Los jugadores conectados seran desconectados mientras el servidor reinicia." />
      <Confirm online={online} busy={busy} run={run} size={size} action="stop" label="Detener" variant="destructive" icon={<Square />}
        desc="Se guardara el mundo y se apagara el servidor. Los jugadores seran desconectados." />
    </div>
  );
}

function Confirm({ action, label, desc, icon, variant, online, busy, run, size }: {
  action: Action; label: string; desc: string; icon: React.ReactNode; variant: "destructive" | "outline";
  online: boolean; busy: Action | null; run: (a: Action) => void; size: "sm" | "default" | "lg";
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size={size} variant={variant} disabled={!online || busy !== null} />}>
        {busy === action ? <Loader2 className="animate-spin" /> : icon}
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label} el servidor?</AlertDialogTitle>
          <AlertDialogDescription>{desc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant={variant === "destructive" ? "destructive" : "default"} onClick={() => run(action)}>
            Si, {label.toLowerCase()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
