"use client";
import { useEffect, useState } from "react";

// Catalogo de items y encantamientos de mods generado por scripts/mod-items.mjs (public/mod-items/index.json)
export type ModItem = { id: string; en: string; es?: string; icon?: string };
export type Mod = { id: string; name: string; title?: string; version: string; description: string; homepage: string | null; modrinth?: string; wiki?: string | null; icon_url?: string | null; items: ModItem[] };
export type ModEnchant = { id: string; en: string; es?: string; max: number; mod: string; ex?: string[] };
export type ModCatalog = { generated: string; mods: Mod[]; enchantments?: ModEnchant[]; itemEnch?: Record<string, number[]> };

let cache: Promise<ModCatalog> | null = null;
const load = () => (cache ??= fetch("/mod-items/index.json").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).catch((e) => { cache = null; throw e; }));

export function useModCatalog() {
  const [data, setData] = useState<ModCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { load().then(setData).catch((e) => setError((e as Error).message)); }, []);
  return { data, error };
}

// Encantamientos que aplican a un item (id completo "ns:id"), en el formato que usa la fila de encantamiento
export function enchantsFor(cat: ModCatalog | null, itemId: string) {
  const all = cat?.enchantments ?? [];
  return (cat?.itemEnch?.[itemId] ?? []).map((i) => all[i]).filter(Boolean);
}

export const CURSES = new Set(["minecraft:vanishing_curse", "minecraft:binding_curse"]);

// Todos los compatibles al maximo, sin curses y respetando conjuntos exclusivos (gana el primero)
const PREFER = ["minecraft:sharpness", "minecraft:protection", "minecraft:fortune", "minecraft:mending", "minecraft:multishot", "minecraft:loyalty", "minecraft:density"];
export function bestEnchants(list: ModEnchant[]) {
  const out: Record<string, number> = {};
  const blocked = new Set<string>();
  const rank = (e: ModEnchant) => { const i = PREFER.indexOf(e.id); return i < 0 ? PREFER.length : i; };
  for (const e of [...list].sort((a, b) => rank(a) - rank(b))) {
    if (CURSES.has(e.id) || blocked.has(e.id)) continue;
    out[e.id] = e.max;
    for (const x of e.ex ?? []) blocked.add(x);
  }
  return out;
}
