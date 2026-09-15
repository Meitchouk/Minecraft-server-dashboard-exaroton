import { clearSessionCookie } from "@/lib/auth";
import { handle } from "@/lib/route";
export const POST = handle(async () => { await clearSessionCookie(); return { ok: true }; });
