import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Firestore desde el servidor (firebase-admin). Se activa solo si existe la clave de cuenta de servicio:
//   FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json  (ruta)  o el JSON completo en la variable.
// Si no esta configurado, db() devuelve null y el resto del panel sigue usando archivos/localStorage.

type G = typeof globalThis & { __exaFirebase?: { app: App | null; reason: string } };
const g = globalThis as G;

function load(): { app: App | null; reason: string } {
  if (getApps().length) return { app: getApps()[0], reason: "" };
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return { app: null, reason: "FIREBASE_SERVICE_ACCOUNT no definido" };
  try {
    let json: string;
    if (raw.startsWith("{")) json = raw;
    else {
      const file = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
      if (!existsSync(file)) return { app: null, reason: `No existe ${file}` };
      json = readFileSync(file, "utf8");
    }
    const sa = JSON.parse(json);
    const app = initializeApp({ credential: cert(sa), projectId: sa.project_id ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    return { app, reason: "" };
  } catch (e) {
    return { app: null, reason: `Clave invalida: ${(e as Error).message}` };
  }
}

export function firebaseStatus() {
  g.__exaFirebase ??= load();
  if (!g.__exaFirebase.app) g.__exaFirebase = load(); // reintenta por si el archivo aparecio despues
  return { configured: !!g.__exaFirebase.app, reason: g.__exaFirebase.reason, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null };
}

export function db(): Firestore | null {
  firebaseStatus();
  return g.__exaFirebase?.app ? getFirestore(g.__exaFirebase.app) : null;
}
