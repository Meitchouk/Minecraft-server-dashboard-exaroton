import { getMessages, saveMessages } from "@/lib/watcher";
import { api, defaultServerId } from "@/lib/exaroton";
import { handle, requirePerm, userFrom } from "@/lib/route";
import { audit } from "@/lib/audit";

// Ajustes de bienvenida, mensajes automaticos, Discord y reglas (servidor por defecto)
export const GET = handle(async () => getMessages());
export const POST = handle(async (req) => {
  requirePerm(req, "config.write");
  const patch = await req.json();
  const next = await saveMessages(patch);
  // las reglas viven en el archivo de Essential Commands (/rules)
  if (typeof patch.rules === "string") await api.fileWrite(defaultServerId(), "config/essentialcommands/rules.txt", next.rules.replace(/\r\n/g, "\n") + "\n").catch(() => {});
  await audit({ serverId: defaultServerId(), kind: "action", command: `mensajes: ${Object.keys(patch).join(", ")}`, source: userFrom(req).username });
  return next;
});
