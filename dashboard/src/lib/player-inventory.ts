import "server-only";
import { api, queryConsole } from "@/lib/exaroton";
import { parseInventory, type InvSlot } from "@/lib/snbt";
import { readNbt, toSnbt, child } from "@/lib/nbt";

// Lee Inventory/EnderItems de un jugador conectado.
// 1) `data get` por consola (rapido, al instante).
// 2) Si la respuesta llega recortada ("...", pasa con items con muchos componentes: armas de Arsenal/Paladins,
//    mochilas, etc.), guarda el mundo y lee el .dat del jugador, que siempre esta completo.
export async function readPlayerList(serverId: string, player: string, path: "Inventory" | "EnderItems"): Promise<{ slots: InvSlot[]; source: "console" | "file" } | null> {
  const esc = player.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const line = await queryConsole(serverId, `data get entity ${player} ${path}`, new RegExp(`${esc} has the following entity data: \\[`), 10000);
  const raw = line?.match(/has the following entity data: (\[.*)$/)?.[1]?.trim();
  if (raw && !/(?:[:,\[{]\s*)\.\.\.|\.\.\.\s*[}\]]/.test(raw)) {
    try { return { slots: parseInventory(raw), source: "console" }; } catch { /* recortado o raro: ir al archivo */ }
  }
  if (!line) return null; // el jugador no esta conectado
  return { slots: await fromFile(serverId, player, path), source: "file" };
}

async function fromFile(serverId: string, player: string, path: string): Promise<InvSlot[]> {
  await queryConsole(serverId, "save-all", /Saved the game|Saving is already|saved/i, 20000);
  const cache = JSON.parse(await api.fileRead(serverId, "usercache.json")) as { name: string; uuid: string }[];
  const uuid = cache.find((u) => u.name.toLowerCase() === player.toLowerCase())?.uuid;
  if (!uuid) throw new Error(`No encuentro el UUID de ${player}`);
  const buf = await api.fileReadBinary(serverId, `world/players/data/${uuid}.dat`);
  const list = child(readNbt(buf), path);
  return list ? parseInventory(toSnbt(list)) : [];
}
