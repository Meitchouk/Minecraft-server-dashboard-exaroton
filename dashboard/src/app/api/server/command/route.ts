import { api, ExarotonError } from "@/lib/exaroton";
import { checkCommands, handle, serverIdFrom, userFrom } from "@/lib/route";
import { audit } from "@/lib/audit";

export const POST = handle(async (req) => {
  const { command } = await req.json();
  if (!command?.trim()) throw new ExarotonError("Comando vacio", 400);
  checkCommands(req, [command]);
  const id = serverIdFrom(req);
  const r = await api.command(id, command.trim());
  await audit({ serverId: id, kind: "command", command: command.trim(), source: userFrom(req).username });
  return r;
});
