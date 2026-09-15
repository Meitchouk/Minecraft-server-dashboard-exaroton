import { listPresence } from "@/lib/watcher";
import { handle, q, serverIdFrom } from "@/lib/route";
// ?hours=24 -> eventos de entrada/salida y muestras de jugadores conectados
export const GET = handle(async (req) => {
  const hours = Math.min(24 * 30, Math.max(1, Number(q(req, "hours", "24")) || 24));
  const now = Date.now();
  return { now, ...(await listPresence(serverIdFrom(req), now - hours * 3600000)) };
});
