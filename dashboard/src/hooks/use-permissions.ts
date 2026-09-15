"use client";
import { useMemo, useSyncExternalStore } from "react";
import { useMe } from "@/hooks/use-me";
import { getOwnToken } from "@/lib/client";
import { permissionsFor, describeDenied, type Perm } from "@/lib/permissions";

const sub = (cb: () => void) => { window.addEventListener("exaroton:server-changed", cb); return () => window.removeEventListener("exaroton:server-changed", cb); };

// Permisos efectivos en el cliente: rol del usuario + si esta usando su propia API key.
// La API vuelve a comprobarlos en cada peticion; aqui solo sirven para ocultar/deshabilitar controles.
export function usePermissions() {
  const me = useMe();
  const ownKey = useSyncExternalStore(sub, () => !!getOwnToken(), () => false);
  return useMemo(() => {
    const perms = me ? permissionsFor(me.role, ownKey) : new Set<Perm>();
    return {
      ready: !!me,
      isAdmin: me?.role === "admin",
      ownKey,
      can: (p: Perm) => perms.has(p),
      why: (p: Perm) => describeDenied(p),
    };
  }, [me, ownKey]);
}
