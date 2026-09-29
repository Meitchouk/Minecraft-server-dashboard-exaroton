"use client";
import { cn } from "@/lib/utils";
import { type Catalog } from "@/hooks/use-catalog";
import { type ModCatalog } from "@/hooks/use-mod-catalog";

// Iconos y nombres de objetos/encantamientos (vanilla + mods) compartidos por Inventario y Recuperar objetos
export type Lookup = { item: Map<string, { name: string; icon?: string }>; ench: Map<string, string> };

// Nombres e iconos de objetos/encantamientos de mods (catalogo generado desde los jars del servidor)
export function lookupFor(cat: ModCatalog | null): Lookup {
  const item = new Map<string, { name: string; icon?: string }>();
  for (const m of cat?.mods ?? []) for (const i of m.items) item.set(i.id, { name: i.es ?? i.en, icon: i.icon });
  const ench = new Map<string, string>();
  for (const e of cat?.enchantments ?? []) ench.set(e.id.replace(/^minecraft:/, ""), e.es ?? e.en);
  return { item, ench };
}

export const enchName = (k: string, catalog: Catalog | null, look: Lookup) => catalog?.enchantments.find((e) => e.name === k)?.es ?? look.ench.get(k) ?? k.split(":").pop()!.replace(/_/g, " ");
export const slotLabel = (n: number) => ({ 103: "casco", 102: "pechera", 101: "pantalones", 100: "botas", [-106]: "mano sec." } as Record<number, string>)[n] ?? `slot ${n}`;

// Icono: objetos vanilla desde mc.nerothe.com; los de mods desde /mod-items (textura extraida del jar)
export function ItemIcon({ id, version, look, className, fallback }: { id: string; version: string; look: Lookup; className?: string; fallback?: string }) {
  const mod = id.includes(":") ? look.item.get(id) : undefined;
  if (id.includes(":")) {
    return mod?.icon
      ? <span className={cn("shrink-0 bg-no-repeat [image-rendering:pixelated]", className)} style={{ backgroundImage: `url(/mod-items/${mod.icon})`, backgroundSize: "100% auto", backgroundPosition: "top" }} />
      : <span className={cn("grid shrink-0 place-items-center break-all px-0.5 text-center text-[8px] leading-tight", className)}>{fallback ?? id.split(":").pop()}</span>;
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://mc.nerothe.com/img/${version.startsWith("1.") ? version : "1.21.4"}/minecraft_${id}.png`} alt="" className={cn("[image-rendering:pixelated]", className)} loading="lazy"
        onError={(e) => { const el = e.currentTarget as HTMLImageElement; el.style.display = "none"; el.nextElementSibling?.classList.remove("hidden"); }} />
      <span className="hidden max-w-full break-all px-0.5 text-center text-[8px] leading-tight">{fallback ?? id}</span>
    </>
  );
}
