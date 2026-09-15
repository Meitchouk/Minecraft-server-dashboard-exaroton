import { getStatus, runBackup } from "@/lib/backup";
import { handle, serverIdFrom } from "@/lib/route";
export const POST = handle(async (req) => {
  const result = await runBackup(serverIdFrom(req));
  getStatus().lastResult = result;
  return { result };
});
