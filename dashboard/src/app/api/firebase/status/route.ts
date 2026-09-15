import { firebaseStatus } from "@/lib/firebase";
import { handle } from "@/lib/route";
export const GET = handle(async () => firebaseStatus());
