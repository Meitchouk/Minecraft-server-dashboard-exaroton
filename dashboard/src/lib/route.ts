import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ExarotonError, defaultServerId } from "./exaroton";
import { tokenContext } from "./token-context";

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
      const data = await tokenContext.run(own, () => fn(req, ctx));
      return NextResponse.json({ ok: true, data });
    } catch (e) {
      const err = e as ExarotonError;
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status ?? 500 });
    }
  };
}

export const q = (req: NextRequest, key: string, fallback = "") => req.nextUrl.searchParams.get(key) ?? fallback;

// Usuario autenticado (lo pone el proxy tras validar la cookie de sesion)
export const userFrom = (req: NextRequest) => ({ username: req.headers.get("x-user") ?? "", role: (req.headers.get("x-role") as "admin" | "user" | null) ?? "user" });
