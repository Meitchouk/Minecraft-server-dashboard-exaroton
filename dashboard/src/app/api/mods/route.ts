import { api, ExarotonError } from "@/lib/exaroton";
import { handle, requirePerm, serverIdFrom } from "@/lib/route";

// Gestor de mods: lista /mods y /mods-disabled y mueve un jar entre ambas carpetas (descargar -> subir -> comprobar tamano -> borrar).
// Los cambios solo se aplican al reiniciar el servidor.
type Mod = { name: string; size: number };

async function list(id: string, dir: string): Promise<Mod[]> {
  try {
    const info = await api.fileInfo(id, dir);
    return (info.children ?? []).filter((c) => !c.isDirectory && /\.jar$/i.test(c.name)).map((c) => ({ name: c.name, size: c.size })).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  } catch { return []; }
}

export const GET = handle(async (req) => {
  const id = serverIdFrom(req);
  const [enabled, disabled] = await Promise.all([list(id, "mods"), list(id, "mods-disabled")]);
  return { enabled, disabled };
});

export const POST = handle(async (req) => {
  requirePerm(req, "files.write");
  const id = serverIdFrom(req);
  const { action, name } = (await req.json()) as { action: "disable" | "enable"; name: string };
  if (!/^[\w.+\-\[\]() ]+\.jar$/i.test(name ?? "") || name.includes("..")) throw new ExarotonError("Nombre de mod no valido", 400);
  const [from, to] = action === "disable" ? ["mods", "mods-disabled"] : action === "enable" ? ["mods-disabled", "mods"] : [null, null];
  if (!from || !to) throw new ExarotonError("Accion no valida", 400);
  const src = (await list(id, from)).find((m) => m.name === name);
  if (!src) throw new ExarotonError("El mod ya no esta en " + from, 404);
  if ((await list(id, to)).some((m) => m.name === name)) throw new ExarotonError("Ya existe un mod con ese nombre en " + to, 409);
  if (to === "mods-disabled") { try { await api.fileInfo(id, "mods-disabled"); } catch { await api.mkdir(id, "mods-disabled"); } }
  const buf = await api.fileReadBinary(id, `${from}/${name}`);
  if (buf.length !== src.size) throw new ExarotonError("La descarga no coincide con el tamano original; no se movio nada", 502);
  await api.fileWrite(id, `${to}/${name}`, buf);
  const copied = (await list(id, to)).find((m) => m.name === name);
  if (!copied || copied.size !== src.size) throw new ExarotonError("La copia no se verifico; el original se conserva", 502);
  await api.fileDelete(id, `${from}/${name}`);
  return { moved: name, to };
});
