import { api } from "@/lib/exaroton";
import { handle, q, serverIdFrom } from "@/lib/route";

// Catalogo de items/encantamientos/efectos/entidades de Minecraft por version (PrismarineJS/minecraft-data)
// + traducciones al espanol desde los assets oficiales (InventivetalentDev/minecraft-assets).
// Se elige la version exacta del servidor o la mas cercana disponible. Cache en memoria del proceso.
const CDN = "https://cdn.jsdelivr.net/gh/PrismarineJS/minecraft-data@master/data";
const ASSETS = "https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets";
const cache = new Map<string, unknown>();

async function fetchJson<T>(url: string): Promise<T | null> {
  if (cache.has(url)) return cache.get(url) as T;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const json = (await res.json()) as T;
  cache.set(url, json);
  return json;
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
  const paths = await fetchJson<Paths>(`${CDN}/dataPaths.json`);
  if (!paths) throw new Error("No se pudo descargar el indice de minecraft-data");
  const all = Object.keys(paths.pc).filter((k) => paths.pc[k].items && /^\d+(\.\d+)+$/.test(k)).sort(cmp);
  if (want && paths.pc[want]?.items) return { version: want, paths: paths.pc[want] };
  const below = want ? all.filter((k) => cmp(k, want) <= 0) : [];
  const pick = below.at(-1) ?? all.at(-1)!;
  return { version: pick, paths: paths.pc[pick] };
}

// Archivo de idioma: intenta la version del servidor, luego la resuelta, luego una conocida
async function loadLang(lang: string, versions: string[]) {
  if (lang === "en") return {};
  for (const v of [...versions, "1.21.11"]) {
    if (!v) continue;
    const j = await fetchJson<Record<string, string>>(`${ASSETS}@${v}/assets/minecraft/lang/${lang}.json`);
    if (j) return j;
  }
  return {};
}

type Item = { name: string; displayName: string; stackSize: number };
type Ench = { name: string; displayName: string; maxLevel: number };
type Effect = { name: string; displayName: string; type: "good" | "bad" };
type Entity = { name: string; displayName: string; type: string };

type ItemCategory = "weapon" | "armor" | "tool" | "food" | "potion" | "material" | "block" | "egg" | "other";

const FOOD = new Set(["apple", "bread", "cake", "cookie", "melon_slice", "golden_apple", "enchanted_golden_apple", "carrot", "golden_carrot", "potato", "baked_potato", "poisonous_potato", "beetroot", "beetroot_soup", "mushroom_stew", "rabbit_stew", "suspicious_stew", "dried_kelp", "beef", "cooked_beef", "porkchop", "cooked_porkchop", "chicken", "cooked_chicken", "mutton", "cooked_mutton", "rabbit", "cooked_rabbit", "cod", "cooked_cod", "salmon", "cooked_salmon", "tropical_fish", "pufferfish", "honey_bottle", "sweet_berries", "glow_berries", "chorus_fruit", "rotten_flesh", "spider_eye", "pumpkin_pie", "milk_bucket"]);

function categorize(name: string, isBlock: boolean): ItemCategory {
  if (/_spawn_egg$/.test(name)) return "egg";
  if (/(_helmet|_chestplate|_leggings|_boots|_horse_armor|_harness)$|^(elytra|shield|wolf_armor)$/.test(name)) return "armor";
  if (/_sword$|^(bow|crossbow|trident|mace|arrow|spectral_arrow|tipped_arrow|wind_charge|fire_charge|egg|snowball|ender_pearl|end_crystal)$/.test(name)) return "weapon";
  if (/(_pickaxe|_axe|_shovel|_hoe|_bucket|_on_a_stick)$|^(shears|flint_and_steel|fishing_rod|compass|recovery_compass|clock|spyglass|brush|lead|name_tag|bucket|saddle|totem_of_undying|firework_rocket|map|filled_map|writable_book|written_book|goat_horn|bundle)$/.test(name)) return "tool";
  if (FOOD.has(name)) return "food";
  if (/^(potion|splash_potion|lingering_potion|glass_bottle|experience_bottle|dragon_breath|fermented_spider_eye|glistering_melon_slice|magma_cream|phantom_membrane|rabbit_foot|turtle_scute|blaze_powder|ghast_tear|nether_wart|brewing_stand|cauldron)$/.test(name)) return "potion";
  if (/(_ingot|_nugget|_dust|_shard|_scrap|_template|_pottery_sherd|_crystals)$|^(diamond|emerald|coal|charcoal|lapis_lazuli|quartz|stick|string|leather|flint|feather|bone|bone_meal|slime_ball|blaze_rod|breeze_rod|nether_star|heart_of_the_sea|nautilus_shell|echo_shard|redstone|glowstone_dust|gunpowder|paper|book|sugar|wheat|wheat_seeds|clay_ball|brick|nether_brick|prismarine_shard|honeycomb|ink_sac|glow_ink_sac|rabbit_hide|armadillo_scute|resin_clump|resin_brick|iron_ingot|gold_ingot|copper_ingot|netherite_ingot)$/.test(name)) return "material";
  if (isBlock) return "block";
  return "other";
}

// Tipos de pocion (minecraft:potion[potion_contents=minecraft:X]); la traduccion sale de item.minecraft.potion.effect.X
const POTIONS = ["water", "mundane", "thick", "awkward", "night_vision", "long_night_vision", "invisibility", "long_invisibility", "leaping", "long_leaping", "strong_leaping", "fire_resistance", "long_fire_resistance", "swiftness", "long_swiftness", "strong_swiftness", "slowness", "long_slowness", "strong_slowness", "turtle_master", "long_turtle_master", "strong_turtle_master", "water_breathing", "long_water_breathing", "healing", "strong_healing", "harming", "strong_harming", "poison", "long_poison", "strong_poison", "regeneration", "long_regeneration", "strong_regeneration", "strength", "long_strength", "strong_strength", "weakness", "long_weakness", "luck", "slow_falling", "long_slow_falling", "wind_charged", "weaving", "oozing", "infested"];

const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

export const GET = handle(async (req) => {
  const id = serverIdFrom(req);
  const lang = q(req, "lang", "es_mx");
  let want = q(req, "version");
  if (!want) {
    const s = await api.server(id).catch(() => null);
    want = parseMcVersion(s?.software?.version);
  }
  const { version, paths } = await resolveVersion(want);
  const [items, enchantments, effects, entities, L] = await Promise.all([
    fetchJson<Item[]>(`${CDN}/${paths.items}/items.json`).then((r) => r ?? []),
    paths.enchantments ? fetchJson<Ench[]>(`${CDN}/${paths.enchantments}/enchantments.json`).then((r) => r ?? []) : Promise.resolve([] as Ench[]),
    paths.effects ? fetchJson<Effect[]>(`${CDN}/${paths.effects}/effects.json`).then((r) => r ?? []) : Promise.resolve([] as Effect[]),
    paths.entities ? fetchJson<Entity[]>(`${CDN}/${paths.entities}/entities.json`).then((r) => r ?? []) : Promise.resolve([] as Entity[]),
    loadLang(lang, [want, version]),
  ]);

  const mods = await api.fileInfo(id, "mods").then((d) => (d.children ?? []).filter((c) => !c.isDirectory).map((c) => c.name)).catch(() => [] as string[]);

  const tr = (key: string) => L[key] as string | undefined;

  return {
    requested: want || null,
    version,
    lang: Object.keys(L).length ? lang : "en",
    items: items.map(({ name, displayName, stackSize }) => {
      const isBlock = !!tr(`block.minecraft.${name}`) && !tr(`item.minecraft.${name}`);
      return { name, displayName, stackSize, es: tr(`item.minecraft.${name}`) ?? tr(`block.minecraft.${name}`) ?? null, category: categorize(name, isBlock) };
    }),
    potions: POTIONS.map((p) => ({ name: p, es: tr(`item.minecraft.potion.effect.${p}`) ?? null })),
    enchantments: enchantments.map(({ name, displayName, maxLevel }) => ({ name, displayName, maxLevel, es: tr(`enchantment.minecraft.${name}`) ?? null })),
    effects: effects.map(({ name, displayName, type }) => ({ name, displayName, type, es: tr(`effect.minecraft.${snake(name)}`) ?? null })),
    entities: entities
      .filter((e) => ["mob", "animal", "hostile", "water_creature", "ambient"].includes(e.type))
      .map(({ name, displayName, type }) => ({ name, displayName, type, es: tr(`entity.minecraft.${name}`) ?? null })),
    mods,
  };
});
