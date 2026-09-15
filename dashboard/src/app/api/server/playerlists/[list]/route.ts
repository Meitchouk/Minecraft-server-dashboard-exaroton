import { api } from "@/lib/exaroton";
import { handle, requirePerm, serverIdFrom } from "@/lib/route";

// whitelist: cualquier usuario; ops y baneos: solo con permiso
const guard = (req: Parameters<typeof requirePerm>[0], list: string) => {
  if (list === "ops") requirePerm(req, "players.ops");
  else if (list.startsWith("banned")) requirePerm(req, "players.bans");
};

export const GET = handle(async (req, { params }) => api.playerList(serverIdFrom(req), (await params).list));
export const PUT = handle(async (req, { params }) => {
  const { list } = await params;
  guard(req, list);
  const { entries } = await req.json();
  return api.playerListAdd(serverIdFrom(req), list, entries);
});
export const DELETE = handle(async (req, { params }) => {
  const { list } = await params;
  guard(req, list);
  const { entries } = await req.json();
  return api.playerListRemove(serverIdFrom(req), list, entries);
});
