"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client";

// Contexto compartido para ejecutar comandos desde cualquier parte de la pagina de Comandos,
// con historial de lo ejecutado y estado "online" del servidor.
type Entry = { id: number; command: string; at: number; ok: boolean; error?: string };

type Ctx = {
  online: boolean;
  running: boolean;
  history: Entry[];
  run: (command: string, opts?: { quiet?: boolean }) => Promise<boolean>;
  clear: () => void;
};

const CommandCtx = createContext<Ctx | null>(null);

export function CommandProvider({ online, children }: { online: boolean; children: React.ReactNode }) {
  const [history, setHistory] = useState<Entry[]>([]);
  const [running, setRunning] = useState(false);

  const run = useCallback(async (command: string, opts: { quiet?: boolean } = {}) => {
    const cmd = command.trim().replace(/^\//, "");
    if (!cmd) return false;
    if (!online) { toast.error("El servidor debe estar en linea"); return false; }
    setRunning(true);
    try {
      await apiFetch("/api/server/command", { method: "POST", body: JSON.stringify({ command: cmd }) });
      if (!opts.quiet) setHistory((h) => [{ id: Date.now(), command: cmd, at: Date.now(), ok: true }, ...h].slice(0, 100));
      if (!opts.quiet) toast.success("Ejecutado", { description: `/${cmd}` });
      return true;
    } catch (e) {
      const error = (e as Error).message;
      setHistory((h) => [{ id: Date.now(), command: cmd, at: Date.now(), ok: false, error }, ...h].slice(0, 100));
      toast.error("Fallo el comando", { description: error });
      return false;
    } finally { setRunning(false); }
  }, [online]);

  return <CommandCtx.Provider value={{ online, running, history, run, clear: () => setHistory([]) }}>{children}</CommandCtx.Provider>;
}

export function useCommands() {
  const c = useContext(CommandCtx);
  if (!c) throw new Error("useCommands fuera de CommandProvider");
  return c;
}
