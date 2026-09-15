"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { apiFetch, getServerId, type ServerInfo } from "@/lib/client";

type State<T> = { data: T | null; error: string | null; loaded: boolean; key: number };

// Polling generico: ejecuta fn al montar, cada `interval` ms, al cambiar `deps` y al cambiar de servidor.
export function usePoll<T>(fn: () => Promise<T>, interval = 0, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loaded: false, key: 0 });
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });

  const refresh = useCallback(async () => {
    try {
      const d = await fnRef.current();
      setState((s) => ({ data: d, error: null, loaded: true, key: s.key + 1 }));
    } catch (e) {
      setState((s) => ({ ...s, error: (e as Error).message, loaded: true }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("exaroton:server-changed", onChange);
    let t: ReturnType<typeof setInterval> | undefined;
    if (interval > 0) t = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, interval);
    return () => { window.removeEventListener("exaroton:server-changed", onChange); if (t) clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, interval, ...deps]);

  const setData = useCallback((d: T) => setState((s) => ({ ...s, data: d, key: s.key + 1 })), []);

  return { data: state.data, error: state.error, loading: !state.loaded, refresh, setData, key: state.key };
}

export function useServer(interval = 5000) {
  return usePoll(() => apiFetch<ServerInfo>("/api/server"), interval);
}

const subscribe = (cb: () => void) => {
  window.addEventListener("exaroton:server-changed", cb);
  return () => window.removeEventListener("exaroton:server-changed", cb);
};

export function useServerId() {
  return useSyncExternalStore(subscribe, getServerId, () => "");
}

// Sincroniza un estado editable ("draft") con un valor remoto cada vez que este cambia (patron recomendado por React:
// ajustar estado durante el render comparando con el valor anterior, sin useEffect).
export function useDraft<T>(source: T | null, key: number) {
  const [draft, setDraft] = useState<T | null>(source);
  const [seen, setSeen] = useState(key);
  if (key !== seen) { setSeen(key); setDraft(source); }
  return [draft, setDraft] as const;
}
