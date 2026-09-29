import "server-only";
import { api, queryConsole } from "@/lib/exaroton";
import { parseInventory, parseSnbt, rawOf, type InvSlot } from "@/lib/snbt";
import { readNbt, toSnbt, child } from "@/lib/nbt";

// Lee Inventory/EnderItems de un jugador conectado.
// 1) `data get` por consola (rapido, al instante).
// 2) Si la respuesta llega recortada ("...", pasa con items con muchos componentes: armas de Arsenal/Paladins,
//    mochilas, etc.), guarda el mundo y lee el .dat del jugador, que siempre esta completo.
// En 26.2 la armadura y la mano secundaria NO estan en Inventory sino en `equipment`: se leen tambien y se
// devuelven con los slots clasicos (100-103 armadura, -106 mano secundaria) para la UI y las copias.
const EQUIP_SLOTS: Record<string, number> = { feet: 100, legs: 101, chest: 102, head: 103, offhand: -106 };
const truncated = (raw: string) => /(?:[:,[{]\s*)\.\.\.|\.\.\.\s*[}\]]/.test(raw);

export async function readPlayerList(serverId: string, player: string, path: "Inventory" | "EnderItems"): Promise<{ slots: InvSlot[]; source: "console" | "file" } | null> {
  const main = await consoleRead(serverId, player, path, "\\[");
  if (main === null) return null; // el jugador no esta conectado
  const equip = path === "Inventory" ? await consoleRead(serverId, player, "equipment", "\\{") : "";
  try {
    if (main && !truncated(main) && (equip === null || !truncated(equip))) {
      return { slots: [...parseInventory(main), ...(equip ? equipmentToSlots(equip) : [])], source: "console" };
    }
  } catch { /* recortado o raro: ir al archivo */ }
  return { slots: await fromFile(serverId, player, path), source: "file" };
}

// Devuelve el texto tras "has the following entity data:", "" si no hay datos (p. ej. sin armadura) o null si no respondio
async function consoleRead(serverId: string, player: string, path: string, open: string): Promise<string | null> {
  const esc = player.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const line = await queryConsole(serverId, `data get entity ${player} ${path}`, new RegExp(`${esc} has the following entity data: ${open}|Found no elements matching ${path}|No entity was found`), 10000);
  if (!line) return null;
  if (/No entity was found/.test(line)) return null;
  const m = line.match(/has the following entity data: (.*)$/);
  return m ? m[1].trim() : "";
}

// {head: {...}, chest: {...}} -> slots 103/102/... reutilizando parseInventory (conserva los componentes exactos)
function equipmentToSlots(raw: string): InvSlot[] {
  const obj = parseSnbt(raw);
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  const pieces = rawOf(obj);
  const list = Object.entries(pieces)
    .map(([k, v]) => [k.replace(/^"|"$/g, ""), v.trim()] as const)
    .filter(([k, v]) => k in EQUIP_SLOTS && v.startsWith("{") && v.length > 2)
    .map(([k, v]) => `{Slot: ${EQUIP_SLOTS[k]}b, ${v.slice(1)}`);
  return list.length ? parseInventory(`[${list.join(", ")}]`) : [];
}

async function fromFile(serverId: string, player: string, path: string): Promise<InvSlot[]> {
  await queryConsole(serverId, "save-all", /Saved the game|Saving is already|saved/i, 20000);
  const cache = JSON.parse(await api.fileRead(serverId, "usercache.json")) as { name: string; uuid: string }[];
  const uuid = cache.find((u) => u.name.toLowerCase() === player.toLowerCase())?.uuid;
  if (!uuid) throw new Error(`No encuentro el UUID de ${player}`);
  const root = readNbt(await api.fileReadBinary(serverId, `world/players/data/${uuid}.dat`));
  const list = child(root, path);
  const slots = list ? parseInventory(toSnbt(list)) : [];
  const eq = path === "Inventory" ? child(root, "equipment") : undefined;
  return eq ? [...slots, ...equipmentToSlots(toSnbt(eq))] : slots;
}
