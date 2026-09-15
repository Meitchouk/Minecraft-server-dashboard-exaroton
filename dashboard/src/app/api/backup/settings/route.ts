import { getSettings, saveSettings } from "@/lib/backup";
import { handle, requirePerm } from "@/lib/route";
export const GET = handle(() => getSettings());
export const POST = handle(async (req) => { requirePerm(req, "backup.settings"); return saveSettings(await req.json()); });
