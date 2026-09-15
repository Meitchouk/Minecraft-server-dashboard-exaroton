import { startWatcher, watcherStatus } from "@/lib/watcher";
import { handle } from "@/lib/route";
export const GET = handle(async () => { await startWatcher(); return watcherStatus(); });
