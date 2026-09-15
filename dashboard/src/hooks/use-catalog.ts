"use client";
import { usePoll } from "@/hooks/use-server";
import { apiFetch } from "@/lib/client";

export type Catalog = {
  requested: string | null;
  version: string;
  items: { name: string; displayName: string; stackSize: number }[];
  enchantments: { name: string; displayName: string; maxLevel: number }[];
  effects: { name: string; displayName: string; type: "good" | "bad" }[];
  entities: { name: string; displayName: string; type: string }[];
  mods: string[];
};

export function useCatalog() {
  return usePoll(() => apiFetch<Catalog>("/api/items"));
}

const vkey = (v: string) => v.split(".").map(Number);
export function versionAtLeast(v: string, min: string) {
  const a = vkey(v), b = vkey(min);
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? 0) - (b[i] ?? 0); if (d) return d > 0; }
  return true;
}

// localStorage tipado y seguro
export function loadLS<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export function saveLS(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
