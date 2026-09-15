import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

// Token de Exaroton por peticion. Si el usuario decide usar SU propia API key, esta llega en la cabecera
// x-exaroton-token y vive solo durante la peticion (nunca se guarda ni se registra).
export const tokenContext = new AsyncLocalStorage<string | null>();
export const overrideToken = () => tokenContext.getStore() ?? null;

// Usuario de la peticion (rol verificado contra la base de datos en handle())
export const userContext = new AsyncLocalStorage<{ username: string; role: "admin" | "user" }>();
