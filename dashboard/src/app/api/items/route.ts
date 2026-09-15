import { api } from "@/lib/exaroton";
import { handle, q, serverIdFrom } from "@/lib/route";

// Catalogo de items/encantamientos/efectos/entidades de Minecraft por version (PrismarineJS/minecraft-data).
// Se elige la version exacta del servidor o la mas cercana disponible. Cache en memoria del proceso.
const CDN = "https://cdn.jsdelivr.net/gh/PrismarineJS/minecraft-data@master/data";
const cache = new Map<string, unknown>();

async function cdn<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T;
  const res = await fetch(`${CDN}/${path}`, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`No se pudo descargar ${path}`);
  const json = await res.json();
  cache.set(path, json);
  return json as T;
}

// "26.2 (0.19.5)" -> "26.2" ; "1.21.4" -> "1.21.4"
function parseMcVersion(v: string | undefined) {
  return v?.match(/\d+(?:\.\d+)+/)?.[0] ?? "";
}

const vkey = (v: string) => v.split(".").map(Number);
const cmp = (a: string, b: string) => {
  const x = vkey(a), y = vkey(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d; }
  return 0;
};

type Paths = { pc: Record<string, Record<string, string>> };

async function resolveVersion(want: string) {
  const paths = await cdn<Paths>("dataPaths.json");
  const all = Object.keys(paths.pc).filter((k) => paths.pc[k].items && /^\d+(\.\d+)+$/.test(k)).sort(cmp);
  if (want && paths.pc[want]?.items) return { version: want, paths: paths.pc[want] };
  // mas cercana por debajo; si no hay, la mas reciente
  const below = want ? all.filter((k) => cmp(k, want) <= 0) : [];
  const pick = below.at(-1) ?? all.at(-1)!;
  return { version: pick, paths: paths.pc[pick] };
}

type Item = { name: string; displayName: string; stackSize: number };
type Ench = { name: string; displayName: string; maxLevel: number; category?: string };
type Effect = { name: string; displayName: string; type: "good" | "bad" };
type Entity = { name: string; displayName: string; type: string };

export const GET = handle(async (req) => {
  const id = serverIdFrom(req);
  let want = q(req, "version");
  if (!want) {
    const s = await api.server(id).catch(() => null);
    want = parseMcVersion(s?.software?.version);
  }
  const { version, paths } = await resolveVersion(want);
  const [items, enchantments, effects, entities] = await Promise.all([
    cdn<Item[]>(`${paths.items}/items.json`),
    paths.enchantments ? cdn<Ench[]>(`${paths.enchantments}/enchantments.json`) : Promise.resolve([] as Ench[]),
    paths.effects ? cdn<Effect[]>(`${paths.effects}/effects.json`) : Promise.resolve([] as Effect[]),
    paths.entities ? cdn<Entity[]>(`${paths.entities}/entities.json`) : Promise.resolve([] as Entity[]),
  ]);

  // Lista de mods instalados (solo nombres de archivo) para orientar sobre items no vanilla
  const mods = await api.fileInfo(id, "mods").then((d) => (d.children ?? []).filter((c) => !c.isDirectory).map((c) => c.name)).catch(() => [] as string[]);

  return {
    requested: want || null,
    version,
    items: items.map(({ name, displayName, stackSize }) => ({ name, displayName, stackSize })),
    enchantments: enchantments.map(({ name, displayName, maxLevel }) => ({ name, displayName, maxLevel })),
    effects: effects.map(({ name, displayName, type }) => ({ name, displayName, type })),
    entities: entities.filter((e) => e.type === "mob" || e.type === "animal" || e.type === "hostile" || e.type === "water_creature" || e.type === "ambient")
      .map(({ name, displayName, type }) => ({ name, displayName, type })),
    mods,
  };
});
