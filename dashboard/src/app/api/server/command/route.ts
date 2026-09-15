import { api, ExarotonError } from "@/lib/exaroton";
import { handle, serverIdFrom } from "@/lib/route";

export const POST = handle(async (req) => {
  const { command } = await req.json();
  if (!command?.trim()) throw new ExarotonError("Comando vacio", 400);
  return api.command(serverIdFrom(req), command.trim());
});
