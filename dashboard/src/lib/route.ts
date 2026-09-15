import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ExarotonError, defaultServerId } from "./exaroton";

// Resuelve el servidor objetivo: header x-server-id (elegido en la UI) o el del .env
export function serverIdFrom(req: NextRequest) {
  const id = req.headers.get("x-server-id") || defaultServerId();
  if (!id) throw new ExarotonError("No hay servidor seleccionado (EXAROTON_SERVER_ID)", 400);
  return id;
}

export function handle(fn: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<unknown>) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const data = await fn(req, ctx);
      return NextResponse.json({ ok: true, data });
    } catch (e) {
      const err = e as ExarotonError;
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status ?? 500 });
    }
  };
}

export const q = (req: NextRequest, key: string, fallback = "") => req.nextUrl.searchParams.get(key) ?? fallback;
