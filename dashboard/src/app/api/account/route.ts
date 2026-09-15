import { api } from "@/lib/exaroton";
import { handle } from "@/lib/route";
export const GET = handle(() => api.account());
