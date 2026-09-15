import { api, ExarotonError } from "@/lib/exaroton";
import { handle, serverIdFrom } from "@/lib/route";
import { audit } from "@/lib/audit";

export const POST = handle(async (req) => {
  const { command } = await req.json();
  if (!command?.trim()) throw new ExarotonError("Comando vacio", 400);
  const id = serverIdFrom(req);
  const r = await api.command(id, command.trim());
  await audit({ serverId: id, kind: "command", command: command.trim() });
  return r;
});
