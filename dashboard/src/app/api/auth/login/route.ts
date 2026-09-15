import { authenticate, setSessionCookie } from "@/lib/auth";
import { handle } from "@/lib/route";
import { audit } from "@/lib/audit";

export const POST = handle(async (req) => {
  const { username, password } = await req.json();
  const user = await authenticate(String(username ?? ""), String(password ?? ""));
  await setSessionCookie({ username: user.username, role: user.role });
  await audit({ serverId: "-", kind: "action", command: "login", source: user.username });
  return user;
});
