import { createUser } from "@/lib/auth";
import { handle } from "@/lib/route";

// Cualquiera puede registrarse; la cuenta queda pendiente hasta que un admin la apruebe
export const POST = handle(async (req) => {
  const { username, password } = await req.json();
  return createUser(String(username ?? ""), String(password ?? ""));
});
