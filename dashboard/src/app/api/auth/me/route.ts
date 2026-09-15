import { currentSession, getUser } from "@/lib/auth";
import { handle } from "@/lib/route";
import { ExarotonError } from "@/lib/exaroton";

export const GET = handle(async () => {
  const s = await currentSession();
  if (!s) throw new ExarotonError("No has iniciado sesion", 401);
  const u = await getUser(s.username);
  if (!u || !u.approved) throw new ExarotonError("Cuenta no disponible", 403);
  return { username: u.username, role: u.role, approved: u.approved, lastLogin: u.lastLogin ?? null };
});
