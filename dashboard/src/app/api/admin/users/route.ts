import { createUser, deleteUser, listUsers, requireAdmin, updateUser } from "@/lib/auth";
import { ExarotonError } from "@/lib/exaroton";
import { handle, q } from "@/lib/route";
import { audit } from "@/lib/audit";

export const GET = handle(async () => { await requireAdmin(); return listUsers(); });

// POST { username, password, role?, approved? } -> crea usuario (ya aprobado si lo indica el admin)
export const POST = handle(async (req) => {
  const admin = await requireAdmin();
  const { username, password, role, approved } = await req.json();
  const u = await createUser(String(username ?? ""), String(password ?? ""), { role: role === "admin" ? "admin" : "user", approved: approved !== false });
  await audit({ serverId: "-", kind: "action", command: `admin: crear usuario ${u.username}`, source: admin.username });
  return u;
});

// PATCH { username, approved?, role?, password? }
export const PATCH = handle(async (req) => {
  const admin = await requireAdmin();
  const { username, approved, role, password } = await req.json();
  if (username === admin.username && approved === false) throw new ExarotonError("No puedes desaprobar tu propia cuenta", 400);
  if (username === admin.username && role === "user") throw new ExarotonError("No puedes quitarte el rol de admin", 400);
  const u = await updateUser(String(username ?? ""), { approved, role, password, approvedBy: admin.username });
  await audit({ serverId: "-", kind: "action", command: `admin: ${u.username} -> ${JSON.stringify({ approved, role, password: password ? "(cambiada)" : undefined })}`, source: admin.username });
  return u;
});

export const DELETE = handle(async (req) => {
  const admin = await requireAdmin();
  const username = q(req, "username");
  if (!username) throw new ExarotonError("Falta username", 400);
  if (username === admin.username) throw new ExarotonError("No puedes borrar tu propia cuenta", 400);
  await deleteUser(username);
  await audit({ serverId: "-", kind: "action", command: `admin: borrar usuario ${username}`, source: admin.username });
  return { ok: true };
});
