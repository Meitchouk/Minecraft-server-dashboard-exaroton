import { listPlayers, listSnapshots } from "@/lib/backup";
import { handle, q, serverIdFrom } from "@/lib/route";
export const GET = handle(async (req) => {
  const id = serverIdFrom(req);
  const player = q(req, "player");
  if (!player) return { players: await listPlayers(id) };
  return { snapshots: await listSnapshots(id, player, Number(q(req, "limit", "100")) || 100) };
});
