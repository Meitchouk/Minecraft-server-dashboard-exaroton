// Imprime la clave de servicio en base64 para pegarla como FIREBASE_SERVICE_ACCOUNT_B64 en el hosting.
// Uso: npm run sa:b64            (usa FIREBASE_SERVICE_ACCOUNT de .env.local)
//      npm run sa:b64 -- ruta.json
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let file = process.argv[2];
if (!file) {
  const env = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
  file = env.match(/^FIREBASE_SERVICE_ACCOUNT=(.+)$/m)?.[1]?.trim();
}
if (!file || !existsSync(file)) { console.error("No encuentro el archivo de la clave de servicio."); process.exit(1); }
const json = JSON.parse(readFileSync(path.resolve(file), "utf8")); // valida que sea JSON
process.stdout.write(Buffer.from(JSON.stringify(json)).toString("base64") + "\n");
