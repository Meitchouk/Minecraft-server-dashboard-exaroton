"use client";
import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Estado guardado en la URL (?clave=valor): se conserva al recargar, al compartir el enlace y con atras/adelante.
// El valor por defecto no se escribe en la URL. `push` crea una entrada de historial (pestañas, carpetas); sin ella
// se reemplaza la actual (filtros mientras se escribe).
export function useQueryState(key: string, def = "", opts: { push?: boolean } = {}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = sp.get(key) ?? def;
  const push = !!opts.push;
  const set = useCallback((v: string) => {
    const p = new URLSearchParams(window.location.search);
    if (v === def || v === "") p.delete(key); else p.set(key, v);
    const qs = p.toString();
    const url = pathname + (qs ? `?${qs}` : "");
    if (push) router.push(url, { scroll: false }); else router.replace(url, { scroll: false });
  }, [key, def, push, pathname, router]);
  return [value, set] as const;
}

export function useQueryNumber(key: string, def: number, opts: { push?: boolean } = {}) {
  const [v, set] = useQueryState(key, String(def), opts);
  const n = Number(v);
  return [Number.isFinite(n) ? n : def, (x: number) => set(String(x))] as const;
}

// Variante para cajas de texto/filtros: el valor vive en un estado local (sin latencia al escribir) y se refleja
// en la URL con replaceState, que Next sincroniza con useSearchParams sin navegar.
export function useQueryText(key: string) {
  const sp = useSearchParams();
  const [v, setV] = useState(() => sp.get(key) ?? "");
  const set = useCallback((x: string) => {
    setV(x);
    const p = new URLSearchParams(window.location.search);
    if (x) p.set(key, x); else p.delete(key);
    const qs = p.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [key]);
  return [v, set] as const;
}
