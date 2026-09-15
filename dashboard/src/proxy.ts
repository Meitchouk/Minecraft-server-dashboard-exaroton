import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Protege todo el panel: sin sesion valida -> /login (paginas) o 401 (API).
const PUBLIC = [/^\/login$/, /^\/register$/, /^\/api\/auth\//, /^\/api\/health$/];
const COOKIE = "exa_session";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  type S = { sub?: string; role?: string };
  let session: S | null = null;
  if (token && process.env.AUTH_SECRET) {
    try { session = (await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET))).payload as S; } catch { session = null; }
  }

  if (!session?.sub) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ ok: false, error: "No has iniciado sesion" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  // El usuario viaja en cabeceras para que las rutas API lo usen (auditoria, datos por usuario)
  const headers = new Headers(req.headers);
  headers.set("x-user", String(session.sub));
  headers.set("x-role", String(session.role ?? "user"));
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:png|svg|jpg|ico)$).*)"],
};
