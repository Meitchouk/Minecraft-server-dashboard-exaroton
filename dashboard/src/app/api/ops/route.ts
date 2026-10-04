import { getOps, getOpsStatus, saveOps } from "@/lib/ops";
import { handle, requirePerm } from "@/lib/route";
export const GET = handle(async () => ({ settings: await getOps(), status: getOpsStatus() }));
export const POST = handle(async (req) => { requirePerm(req, "ops.settings"); return { settings: await saveOps(await req.json()), status: getOpsStatus() }; });
