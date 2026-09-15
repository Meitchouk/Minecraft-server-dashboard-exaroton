import { api } from "@/lib/exaroton";
import { handle, serverIdFrom } from "@/lib/route";

export const GET = handle(async (req, { params }) => api.playerList(serverIdFrom(req), (await params).list));
export const PUT = handle(async (req, { params }) => {
  const { entries } = await req.json();
  return api.playerListAdd(serverIdFrom(req), (await params).list, entries);
});
export const DELETE = handle(async (req, { params }) => {
  const { entries } = await req.json();
  return api.playerListRemove(serverIdFrom(req), (await params).list, entries);
});
