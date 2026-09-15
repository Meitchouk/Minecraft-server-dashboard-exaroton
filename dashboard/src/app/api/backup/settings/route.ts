import { getSettings, saveSettings } from "@/lib/backup";
import { handle } from "@/lib/route";
export const GET = handle(() => getSettings());
export const POST = handle(async (req) => saveSettings(await req.json()));
