import { getStatus } from "@/lib/backup";
import { handle } from "@/lib/route";
export const GET = handle(async () => getStatus());
