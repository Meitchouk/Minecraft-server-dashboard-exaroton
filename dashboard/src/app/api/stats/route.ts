import { api } from "@/lib/exaroton";
import { handle, serverIdFrom } from "@/lib/route";

// Estadisticas reales de cada jugador desde world/players/stats/<uuid>.json (26.x; antes world/stats). Se guardan al hacer save.
type Stats = { stats?: Record<string, Record<string, number>> };
const num = (s: Stats, cat: string, key: string) => s.stats?.[cat]?.[key] ?? 0;
const top = (s: Stats, cat: string, n = 5) => Object.entries(s.stats?.[cat] ?? {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ id: k.replace(/^minecraft:/, ""), value: v }));

export const GET = handle(async (req) => {
  const id = serverIdFrom(req);
  const statsDir = await api.fileInfo(id, "world/players/stats").then(() => "world/players/stats").catch(() => "world/stats");
  const [dir, cacheRaw] = await Promise.all([api.fileInfo(id, statsDir), api.fileRead(id, "usercache.json").catch(() => "[]")]);
  let names: Record<string, string> = {};
  try { for (const u of JSON.parse(cacheRaw) as { name: string; uuid: string }[]) names[u.uuid.toLowerCase()] = u.name; } catch { names = {}; }
  const files = (dir.children ?? []).filter((c) => c.name.endsWith(".json"));
  const players = await Promise.all(files.map(async (f) => {
    const uuid = f.name.replace(/\.json$/, "").toLowerCase();
    let s: Stats = {};
    try { s = JSON.parse(await api.fileRead(id, `${statsDir}/${f.name}`)); } catch { s = {}; }
    const c = "minecraft:custom";
    return {
      uuid, name: names[uuid] ?? uuid.slice(0, 8),
      playTimeMin: Math.round(num(s, c, "minecraft:play_time") / 20 / 60),
      deaths: num(s, c, "minecraft:deaths"),
      playerKills: num(s, c, "minecraft:player_kills"),
      mobKills: num(s, c, "minecraft:mob_kills"),
      damageTaken: Math.round(num(s, c, "minecraft:damage_taken") / 10),
      damageDealt: Math.round(num(s, c, "minecraft:damage_dealt") / 10),
      walkedKm: Math.round((num(s, c, "minecraft:walk_one_cm") + num(s, c, "minecraft:sprint_one_cm")) / 100000 * 10) / 10,
      jumps: num(s, c, "minecraft:jump"),
      sleeps: num(s, c, "minecraft:sleep_in_bed"),
      sinceDeathMin: Math.round(num(s, c, "minecraft:time_since_death") / 20 / 60),
      minedTotal: Object.values(s.stats?.["minecraft:mined"] ?? {}).reduce((a, b) => a + b, 0),
      topMined: top(s, "minecraft:mined"),
      topKilled: top(s, "minecraft:killed"),
      topUsed: top(s, "minecraft:used", 3),
      diamonds: num(s, "minecraft:mined", "minecraft:diamond_ore") + num(s, "minecraft:mined", "minecraft:deepslate_diamond_ore"),
    };
  }));
  return players.sort((a, b) => b.playTimeMin - a.playTimeMin);
});
