import { previewWelcome, testDiscord } from "@/lib/watcher";
import { ExarotonError } from "@/lib/exaroton";
import { handle, requirePerm } from "@/lib/route";

// Muestra la bienvenida a un jugador conectado para probar los textos
export const POST = handle(async (req) => {
  requirePerm(req, "config.write");
  const { player, discord } = await req.json();
  if (discord !== undefined) { await testDiscord(String(discord)); return { ok: true }; }
  if (!player || /[^A-Za-z0-9_]/.test(player)) throw new ExarotonError("Jugador invalido", 400);
  await previewWelcome(player);
  return { ok: true };
});
