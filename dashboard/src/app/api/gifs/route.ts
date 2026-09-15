import { getMessages, giphySearch } from "@/lib/watcher";
import { ExarotonError } from "@/lib/exaroton";
import { handle, q } from "@/lib/route";

// Buscador de GIFs (Giphy) para el panel. La key vive en los ajustes; opcionalmente ?key= para probar una nueva.
export const GET = handle(async (req) => {
  const s = await getMessages();
  const key = q(req, "key") || s.discord.giphy.apiKey;
  if (!key) throw new ExarotonError("Configura la API key de Giphy en Mensajes > Discord", 400);
  const query = q(req, "q").trim();
  if (!query) return [];
  return giphySearch(key, query, s.discord.giphy.rating);
});
