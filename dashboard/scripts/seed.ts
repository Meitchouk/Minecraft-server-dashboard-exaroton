// Seed de usuarios: crea (o repara) el administrador inicial en Firestore.
// Uso: npm run seed   (lee SEED_ADMIN_USER / SEED_ADMIN_PASSWORD y FIREBASE_SERVICE_ACCOUNT de .env.local)
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadEnv() {
  const f = path.join(process.cwd(), ".env.local");
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

async function main() {
  loadEnv();
  const user = (process.env.SEED_ADMIN_USER ?? "admin").trim().toLowerCase();
  const pass = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (pass.length < 8) throw new Error("SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres (definelo en .env.local)");
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? "";
  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT ?? "";
  const sa = JSON.parse(b64 ? Buffer.from(b64, "base64").toString("utf8") : saRaw.startsWith("{") ? saRaw : readFileSync(path.isAbsolute(saRaw) ? saRaw : path.join(process.cwd(), saRaw), "utf8"));
  const app = initializeApp({ credential: cert(sa), projectId: sa.project_id });
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pass, salt, 64).toString("hex");
  const ref = db.collection("users").doc(user);
  const existing = await ref.get();
  await ref.set({ username: user, role: "admin", approved: true, approvedAt: Date.now(), approvedBy: "seed", salt, hash, ...(existing.exists ? {} : { createdAt: Date.now(), lastLogin: null }) }, { merge: true });
  console.log(`${existing.exists ? "Actualizado" : "Creado"} admin "${user}" (aprobado, rol admin).`);

  const users = await db.collection("users").get();
  console.log(`Usuarios en la base de datos: ${users.size}`);
  for (const d of users.docs) { const u = d.data(); console.log(` - ${u.username} [${u.role}] ${u.approved ? "aprobado" : "PENDIENTE"}`); }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
