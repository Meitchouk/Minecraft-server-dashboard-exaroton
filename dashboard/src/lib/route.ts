import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ExarotonError, defaultServerId } from "./exaroton";
import { tokenContext, userContext } from "./token-context";
import { accountState } from "./auth";

// Resuelve el servidor objetivo: header x-server-id (elegido en la UI) o el del .env
export function serverIdFrom(req: NextRequest) {
  const id = req.headers.get("x-server-id") || defaultServerId();
  if (!id) throw new ExarotonError("No hay servidor seleccionado (EXAROTON_SERVER_ID)", 400);
  return id;
}

export function handle(fn: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<unknown>) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const own = req.headers.get("x-exaroton-token")?.trim() || null;
      // Sin API key propia se usa la del administrador: solo para cuentas aprobadas
      const username = req.headers.get("x-user");
      const path = req.nextUrl.pathname;
      let user = { username: username ?? "", role: (req.headers.get("x-role") as "admin" | "user" | null) ?? "user" };
      if (username) {
        const st = await accountState(username);
        if (!st.exists) throw new ExarotonError("Tu cuenta ya no existe", 401);
        user = { username, role: st.role };
        const usesAdminToken = !path.startsWith("/api/auth/") && !path.startsWith("/api/firebase/") && !path.startsWith("/api/admin/") && path !== "/api/store/favorites";
        if (!own && usesAdminToken && !st.approved) {
          throw new ExarotonError("Tu cuenta aun no esta aprobada para usar el servidor del administrador. Mientras tanto puedes usar tu propia API key en Ajustes.", 403);
        }
      }
      const data = await userContext.run(user, () => tokenContext.run(own, () => fn(req, ctx)));
      return NextResponse.json({ ok: true, data });
    } catch (e) {
      const err = e as ExarotonError;
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status ?? 500 });
    }
  };
}

export const q = (req: NextRequest, key: string, fallback = "") => req.nextUrl.searchParams.get(key) ?? fallback;

// Usuario autenticado (lo pone el proxy tras validar la cookie de sesion)
export const userFrom = (req: NextRequest) => userContext.getStore() ?? ({ username: req.headers.get("x-user") ?? "", role: (req.headers.get("x-role") as "admin" | "user" | null) ?? "user" });

// ---- Permisos ----
import { permissionsFor, isDangerousCommand, describeDenied, type Perm } from "./permissions";

export function permsOf(req: NextRequest) {
  const { role } = userFrom(req);
  const ownKey = !!req.headers.get("x-exaroton-token")?.trim();
  return permissionsFor(role, ownKey);
}

export function requirePerm(req: NextRequest, perm: Perm) {
  if (!permsOf(req).has(perm)) throw new ExarotonError(describeDenied(perm), 403);
}

// Comandos de consola: los peligrosos solo con command.dangerous
export function checkCommands(req: NextRequest, commands: string[]) {
  if (permsOf(req).has("command.dangerous")) return;
  const bad = commands.find(isDangerousCommand);
  if (bad) throw new ExarotonError(`Comando reservado al administrador: /${bad.replace(/^\//, "")}`, 403);
}
