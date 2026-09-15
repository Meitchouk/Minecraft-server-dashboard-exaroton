"use client";
import { useCallback } from "react";
import { usePoll } from "@/hooks/use-server";
import { apiFetch } from "@/lib/client";

// Coleccion persistida en Firestore (via /api/store/<name>). Reemplaza al localStorage de warps, papelera, favoritos...
export type Stored<T> = T & { id: string; at: number; by?: string | null };

export function useStore<T extends object>(name: string, deps: unknown[] = []) {
  const { data, loading, error, refresh, setData } = usePoll(() => apiFetch<Stored<T>[]>(`/api/store/${name}`), 0, deps);
  const items = data ?? [];

  const put = useCallback(async (item: Partial<Stored<T>> & T) => {
    const saved = await apiFetch<Stored<T>>(`/api/store/${name}`, { method: "PUT", body: JSON.stringify(item) });
    setData([saved, ...(data ?? []).filter((x) => x.id !== saved.id)]);
    return saved;
  }, [name, data, setData]);

  const remove = useCallback(async (id: string) => {
    await apiFetch(`/api/store/${name}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setData((data ?? []).filter((x) => x.id !== id));
  }, [name, data, setData]);

  const removeMany = useCallback(async (ids: string[]) => {
    await Promise.all(ids.map((id) => apiFetch(`/api/store/${name}?id=${encodeURIComponent(id)}`, { method: "DELETE" })));
    setData((data ?? []).filter((x) => !ids.includes(x.id)));
  }, [name, data, setData]);

  const clear = useCallback(async () => {
    await apiFetch(`/api/store/${name}?all=1`, { method: "DELETE" });
    setData([]);
  }, [name, setData]);

  return { items, loading, error, refresh, put, remove, removeMany, clear };
}
