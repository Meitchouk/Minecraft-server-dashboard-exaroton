import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Firestore desde el servidor (firebase-admin). Se activa solo si existe la clave de cuenta de servicio:
//   FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json  (ruta)  o el JSON completo en la variable,
//   o FIREBASE_SERVICE_ACCOUNT_B64 con el JSON en base64 (recomendado para despliegues: evita problemas con
//   los saltos de linea de private_key). Genera el base64 con: npm run sa:b64
// Si no esta configurado, db() devuelve null y el resto del panel sigue usando archivos/localStorage.

type G = typeof globalThis & { __exaFirebase?: { app: App | null; reason: string } };
const g = globalThis as G;

function load(): { app: App | null; reason: string } {
  if (getApps().length) return { app: getApps()[0], reason: "" };
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64?.trim();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw && !b64) return { app: null, reason: "FIREBASE_SERVICE_ACCOUNT / FIREBASE_SERVICE_ACCOUNT_B64 no definido" };
  try {
    let json: string;
    if (b64) json = Buffer.from(b64, "base64").toString("utf8");
    else if (raw!.startsWith("{")) json = raw!;
    else {
      const file = path.isAbsolute(raw!) ? raw! : path.join(process.cwd(), raw!);
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

type G2 = typeof globalThis & { __exaFirestore?: Firestore };
export function db(): Firestore | null {
  firebaseStatus();
  if (!g.__exaFirebase?.app) return null;
  const gg = globalThis as G2;
  if (!gg.__exaFirestore) {
    gg.__exaFirestore = getFirestore(g.__exaFirebase.app);
    // los objetos del inventario llevan campos opcionales (name, etc.) en undefined
    gg.__exaFirestore.settings({ ignoreUndefinedProperties: true });
  }
  return gg.__exaFirestore;
}
