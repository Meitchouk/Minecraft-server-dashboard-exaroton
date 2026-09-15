import { db } from "@/lib/firebase";
import { ExarotonError } from "@/lib/exaroton";
import { handle, q, serverIdFrom, userFrom } from "@/lib/route";

// Almacen generico en Firestore para datos del panel que antes vivian en localStorage.
//  - por servidor (compartidos entre todos los usuarios): warps, trash, custom_items
//  - por usuario: favorites
// GET -> lista | PUT { id?, ...data } -> crea/actualiza | DELETE ?id= | DELETE ?all=1
const SHARED = new Set(["warps", "trash", "custom_items"]);
const PER_USER = new Set(["favorites"]);

function col(req: Parameters<typeof serverIdFrom>[0], name: string) {
  const d = db();
  if (!d) throw new ExarotonError("Firestore no esta configurado", 503);
  if (SHARED.has(name)) return d.collection("servers").doc(serverIdFrom(req)).collection(name);
  if (PER_USER.has(name)) {
    const u = userFrom(req).username;
    if (!u) throw new ExarotonError("No has iniciado sesion", 401);
    return d.collection("users").doc(u).collection(name);
  }
  throw new ExarotonError(`Coleccion desconocida: ${name}`, 404);
}

export const GET = handle(async (req, { params }) => {
  const { name } = await params;
  const snap = await col(req, name).orderBy("at", "desc").limit(500).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
});

export const PUT = handle(async (req, { params }) => {
  const { name } = await params;
  const body = await req.json();
  const c = col(req, name);
  const id = typeof body.id === "string" && body.id ? body.id : c.doc().id;
  const rest = { ...body }; delete rest.id;
  const data = { ...rest, at: typeof rest.at === "number" ? rest.at : Date.now(), by: userFrom(req).username || null };
  await c.doc(id).set(data, { merge: true });
  return { id, ...data };
});

export const DELETE = handle(async (req, { params }) => {
  const { name } = await params;
  const c = col(req, name);
  if (q(req, "all") === "1") {
    const snap = await c.limit(500).get();
    const b = db()!.batch(); snap.docs.forEach((d) => b.delete(d.ref)); await b.commit();
    return { deleted: snap.size };
  }
  const id = q(req, "id");
  if (!id) throw new ExarotonError("Falta id", 400);
  await c.doc(id).delete();
  return { deleted: 1 };
});
