"use client";
import { usePoll } from "@/hooks/use-server";
import { apiFetch } from "@/lib/client";

export type ItemCategory = "weapon" | "armor" | "tool" | "food" | "potion" | "material" | "block" | "egg" | "other";

export type CatalogItem = { name: string; displayName: string; stackSize: number; es: string | null; category: ItemCategory };

export type Catalog = {
  requested: string | null;
  version: string;
  lang: string;
  items: CatalogItem[];
  potions: { name: string; es: string | null }[];
  enchantments: { name: string; displayName: string; maxLevel: number; es: string | null }[];
  effects: { name: string; displayName: string; type: "good" | "bad"; es: string | null }[];
  entities: { name: string; displayName: string; type: string; es: string | null }[];
  mods: string[];
};

export function useCatalog() {
  return usePoll(() => apiFetch<Catalog>("/api/items"));
}

// Nombre para mostrar: espanol si existe, si no ingles
export const label = (x: { es?: string | null; displayName?: string; name: string }) => x.es ?? x.displayName ?? x.name;

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

// ---------- Encantamientos por tipo de objeto ----------
export type GearType = "sword" | "axe" | "pickaxe" | "shovel" | "hoe" | "bow" | "crossbow" | "trident" | "mace" | "helmet" | "chestplate" | "leggings" | "boots" | "elytra" | "shield" | "fishing_rod" | "shears" | "flint_and_steel" | "other_tool";

export function gearType(name: string): GearType | null {
  const n = name.replace(/^minecraft:/, "");
  if (/_sword$/.test(n)) return "sword";
  if (/_axe$/.test(n)) return "axe";
  if (/_pickaxe$/.test(n)) return "pickaxe";
  if (/_shovel$/.test(n)) return "shovel";
  if (/_hoe$/.test(n)) return "hoe";
  if (/_helmet$/.test(n)) return "helmet";
  if (/_chestplate$/.test(n)) return "chestplate";
  if (/_leggings$/.test(n)) return "leggings";
  if (/_boots$/.test(n)) return "boots";
  const map: Record<string, GearType> = { bow: "bow", crossbow: "crossbow", trident: "trident", mace: "mace", elytra: "elytra", shield: "shield", fishing_rod: "fishing_rod", shears: "shears", flint_and_steel: "flint_and_steel", carrot_on_a_stick: "other_tool", warped_fungus_on_a_stick: "other_tool", brush: "other_tool" };
  return map[n] ?? null;
}

const COMMON = ["unbreaking", "mending"];
const ARMOR = ["protection", "fire_protection", "blast_protection", "projectile_protection", "thorns", "binding_curse", "vanishing_curse"];

// applicable: todo lo que el juego permite en ese objeto. recommended: el "best in slot" tipico (nivel = max).
export const GEAR_ENCHANTS: Record<GearType, { applicable: string[]; recommended: string[] }> = {
  sword:      { applicable: ["sharpness", "smite", "bane_of_arthropods", "knockback", "fire_aspect", "looting", "sweeping_edge", ...COMMON, "vanishing_curse"], recommended: ["sharpness", "looting", "fire_aspect", "sweeping_edge", ...COMMON] },
  axe:        { applicable: ["efficiency", "silk_touch", "fortune", "sharpness", "smite", "bane_of_arthropods", ...COMMON, "vanishing_curse"], recommended: ["efficiency", "sharpness", "fortune", ...COMMON] },
  pickaxe:    { applicable: ["efficiency", "silk_touch", "fortune", ...COMMON, "vanishing_curse"], recommended: ["efficiency", "fortune", ...COMMON] },
  shovel:     { applicable: ["efficiency", "silk_touch", "fortune", ...COMMON, "vanishing_curse"], recommended: ["efficiency", "fortune", ...COMMON] },
  hoe:        { applicable: ["efficiency", "silk_touch", "fortune", ...COMMON, "vanishing_curse"], recommended: ["efficiency", "fortune", ...COMMON] },
  bow:        { applicable: ["power", "punch", "flame", "infinity", ...COMMON, "vanishing_curse"], recommended: ["power", "punch", "flame", "infinity", "unbreaking"] },
  crossbow:   { applicable: ["quick_charge", "multishot", "piercing", ...COMMON, "vanishing_curse"], recommended: ["quick_charge", "multishot", ...COMMON] },
  trident:    { applicable: ["loyalty", "channeling", "riptide", "impaling", ...COMMON, "vanishing_curse"], recommended: ["loyalty", "channeling", "impaling", ...COMMON] },
  mace:       { applicable: ["density", "breach", "wind_burst", "smite", "bane_of_arthropods", "fire_aspect", ...COMMON, "vanishing_curse"], recommended: ["density", "wind_burst", "fire_aspect", ...COMMON] },
  helmet:     { applicable: [...ARMOR, "respiration", "aqua_affinity", ...COMMON], recommended: ["protection", "respiration", "aqua_affinity", ...COMMON] },
  chestplate: { applicable: [...ARMOR, ...COMMON], recommended: ["protection", ...COMMON] },
  leggings:   { applicable: [...ARMOR, "swift_sneak", ...COMMON], recommended: ["protection", "swift_sneak", ...COMMON] },
  boots:      { applicable: [...ARMOR, "feather_falling", "depth_strider", "frost_walker", "soul_speed", ...COMMON], recommended: ["protection", "feather_falling", "depth_strider", "soul_speed", ...COMMON] },
  elytra:     { applicable: [...COMMON, "binding_curse", "vanishing_curse"], recommended: [...COMMON] },
  shield:     { applicable: [...COMMON, "vanishing_curse"], recommended: [...COMMON] },
  fishing_rod:{ applicable: ["luck_of_the_sea", "lure", ...COMMON, "vanishing_curse"], recommended: ["luck_of_the_sea", "lure", ...COMMON] },
  shears:     { applicable: ["efficiency", ...COMMON, "vanishing_curse"], recommended: ["efficiency", ...COMMON] },
  flint_and_steel: { applicable: [...COMMON, "vanishing_curse"], recommended: [...COMMON] },
  other_tool: { applicable: [...COMMON, "vanishing_curse"], recommended: [...COMMON] },
};

export const CATEGORY_META: { id: ItemCategory | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "weapon", label: "Armas" },
  { id: "armor", label: "Armadura" },
  { id: "tool", label: "Herramientas" },
  { id: "food", label: "Comida" },
  { id: "potion", label: "Pociones" },
  { id: "material", label: "Materiales" },
  { id: "block", label: "Bloques" },
  { id: "egg", label: "Huevos" },
  { id: "other", label: "Otros" },
];

// Kits de acceso rapido: varios give seguidos con encantamientos recomendados
export const KITS: { id: string; label: string; items: string[] }[] = [
  { id: "armor_netherite", label: "Armadura de netherite", items: ["netherite_helmet", "netherite_chestplate", "netherite_leggings", "netherite_boots"] },
  { id: "armor_diamond", label: "Armadura de diamante", items: ["diamond_helmet", "diamond_chestplate", "diamond_leggings", "diamond_boots"] },
  { id: "armor_iron", label: "Armadura de hierro", items: ["iron_helmet", "iron_chestplate", "iron_leggings", "iron_boots"] },
  { id: "tools_netherite", label: "Herramientas de netherite", items: ["netherite_pickaxe", "netherite_axe", "netherite_shovel", "netherite_hoe"] },
  { id: "tools_diamond", label: "Herramientas de diamante", items: ["diamond_pickaxe", "diamond_axe", "diamond_shovel", "diamond_hoe"] },
  { id: "weapons_netherite", label: "Armas de netherite", items: ["netherite_sword", "netherite_axe", "bow", "shield"] },
  { id: "weapons_diamond", label: "Armas de diamante", items: ["diamond_sword", "diamond_axe", "bow", "shield"] },
  { id: "pvp", label: "Kit PvP completo", items: ["netherite_helmet", "netherite_chestplate", "netherite_leggings", "netherite_boots", "netherite_sword", "bow", "shield", "golden_apple", "arrow"] },
];
