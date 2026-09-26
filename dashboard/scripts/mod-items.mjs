// Genera el catalogo de items de los mods instalados en el servidor para la pestaña "Give > Mods".
//   node scripts/mod-items.mjs <carpeta-con-jars> [lista-de-jars-del-server.txt]
// Lee de cada jar: assets/<ns>/items/*.json (lista real de items en 26.2), nombres (lang en_us/es_*),
// y el icono (modelo -> textura). Enlaza cada mod con su pagina de Modrinth (por hash del jar).
// Salida: public/mod-items/index.json + public/mod-items/<ns>/<id>.png
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const [modsDir, listFile] = process.argv.slice(2);
if (!modsDir) { console.error("uso: node scripts/mod-items.mjs <carpeta-mods> [lista.txt]"); process.exit(1); }
const OUT = path.resolve(process.env.OUT_DIR || "public/mod-items");
const only = listFile ? new Set(fs.readFileSync(listFile, "utf8").split(/\r?\n/).filter(Boolean)) : null;
const prefix = (f) => f.toLowerCase().replace(/[-_ +]?(fabric|mc|v?\d)[\w.+-]*\.jar$/i, "");
const onlyPrefixes = only ? new Set([...only].map(prefix)) : null;
const jars = fs.readdirSync(modsDir).filter((f) => f.endsWith(".jar") && (!only || only.has(f) || onlyPrefixes.has(prefix(f))));

const IGNORE_NS = new Set(["minecraft", "c", "fabric", "neoforge", "forge", "common", "realms"]);
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")); } catch { return null; } };
const rid = (s, ns) => (s.includes(":") ? s.split(":") : [ns, s]);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moditems-"));
const mods = [];
const hashes = {};
// Encantamientos (data-driven desde 1.21): se recogen de todos los jars + vanilla para saber que aplica a cada item
const itemTags = new Map();   // "ns:path" -> Set(valores)
const enchTags = new Map();
const enchants = new Map();   // "ns:id" -> { json, mod }
const langEN = {}, langES = {};
const walk = (dir, base = "") => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(path.join(dir, d.name), base + d.name + "/") : d.name.endsWith(".json") ? [[base + d.name.slice(0, -5), path.join(dir, d.name)]] : []) : [];
function collectData(root, modName) {
  const data = path.join(root, "data");
  if (fs.existsSync(data)) for (const ns of fs.readdirSync(data)) {
    for (const [kind, map] of [["item", itemTags], ["enchantment", enchTags]]) {
      for (const [rel, file] of walk(path.join(data, ns, "tags", kind))) {
        const j = readJson(file); if (!j?.values) continue;
        const key = ns + ":" + rel; if (!map.has(key)) map.set(key, new Set());
        for (const v of j.values) map.get(key).add(typeof v === "string" ? v : v.id);
      }
    }
    for (const [rel, file] of walk(path.join(data, ns, "enchantment"))) { const j = readJson(file); if (j) enchants.set(ns + ":" + rel, { json: j, mod: modName }); }
  }
  const assets = path.join(root, "assets");
  if (fs.existsSync(assets)) for (const ns of fs.readdirSync(assets)) {
    Object.assign(langEN, readJson(path.join(assets, ns, "lang/en_us.json")) ?? {});
    Object.assign(langES, readJson(path.join(assets, ns, "lang/es_es.json")) ?? {}, readJson(path.join(assets, ns, "lang/es_mx.json")) ?? {});
  }
}

for (const jar of jars) {
  const tmp = path.join(tmpRoot, jar.replace(/[^\w.-]/g, "_"));
  fs.mkdirSync(tmp);
  try {
    execFileSync("unzip", ["-q", "-o", "-d", tmp, path.join(modsDir, jar)], { stdio: "ignore" });
  } catch { /* unzip devuelve !=0 si algun patron no existe */ }
  // Algunos mods (p. ej. Adorn) guardan sus recursos en un jar anidado
  const nested = path.join(tmp, "META-INF", "jars");
  if (fs.existsSync(nested)) for (const n of fs.readdirSync(nested).filter((x) => /resources|assets/i.test(x) && x.endsWith(".jar"))) {
    try { execFileSync("unzip", ["-q", "-o", "-d", tmp, path.join(nested, n)], { stdio: "ignore" }); } catch { /* opcional */ }
  }
  const meta = readJson(path.join(tmp, "fabric.mod.json")) ?? {};
  collectData(tmp, meta.name ?? meta.id ?? jar);
  const assets = path.join(tmp, "assets");
  if (!fs.existsSync(assets)) { fs.rmSync(tmp, { recursive: true, force: true }); continue; }
  const items = [];
  for (const ns of fs.readdirSync(assets)) {
    if (IGNORE_NS.has(ns)) continue;
    const itemsDir = path.join(assets, ns, "items");
    if (!fs.existsSync(itemsDir)) continue;
    const L = { ...(readJson(path.join(assets, ns, "lang/en_us.json")) ?? {}) };
    const LES = { ...(readJson(path.join(assets, ns, "lang/es_es.json")) ?? {}), ...(readJson(path.join(assets, ns, "lang/es_mx.json")) ?? {}) };
    for (const f of fs.readdirSync(itemsDir).filter((x) => x.endsWith(".json"))) {
      const id = f.slice(0, -5);
      const keys = [`item.${ns}.${id}`, `block.${ns}.${id}`];
      const en = keys.map((k) => L[k]).find(Boolean) ?? id.replace(/_/g, " ");
      const es = keys.map((k) => LES[k]).find(Boolean);
      // icono: items/<id>.json -> modelo -> textura (layer0 / all / side / ...)
      let icon = null;
      try {
        const def = readJson(path.join(itemsDir, f));
        const find = (o) => (o && typeof o === "object" ? (typeof o.model === "string" ? o.model : Object.values(o).map(find).find(Boolean)) : null);
        let model = find(def?.model ?? def);
        for (let depth = 0; model && depth < 4 && !icon; depth++) {
          const [mns, mp] = rid(model, ns);
          const mj = readJson(path.join(assets, mns, "models", mp + ".json"));
          if (!mj) break;
          const t = mj.textures ?? {};
          const tex = t.layer0 ?? t.all ?? t.side ?? t.front ?? t.top ?? t.texture ?? t.particle ?? Object.values(t).find((v) => typeof v === "string" && !v.startsWith("#"));
          if (tex && !tex.startsWith("#")) {
            const [tns, tp] = rid(tex, mns);
            const src = path.join(assets, tns, "textures", tp + ".png");
            if (fs.existsSync(src)) {
              fs.mkdirSync(path.join(OUT, ns), { recursive: true });
              fs.copyFileSync(src, path.join(OUT, ns, id + ".png"));
              icon = `${ns}/${id}.png`;
            }
          }
          model = mj.parent && !mj.parent.startsWith("minecraft:") && !mj.parent.startsWith("item/") && !mj.parent.startsWith("block/") ? mj.parent : null;
        }
      } catch { /* icono opcional */ }
      items.push({ id: `${ns}:${id}`, en, ...(es && es !== en ? { es } : {}), ...(icon ? { icon } : {}) });
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (!items.length) continue;
  const h = crypto.createHash("sha1").update(fs.readFileSync(path.join(modsDir, jar))).digest("hex");
  hashes[h] = mods.length;
  mods.push({
    id: meta.id ?? jar, name: meta.name ?? meta.id ?? jar, version: meta.version ?? "",
    description: (meta.description ?? "").slice(0, 200),
    homepage: meta.contact?.homepage ?? meta.contact?.sources ?? null,
    items: items.sort((a, b) => a.id.localeCompare(b.id)),
  });
}

// Pagina de Modrinth de cada mod (por hash)
try {
  const r = await fetch("https://api.modrinth.com/v2/version_files", {
    method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Meitchouk/dashboard" },
    body: JSON.stringify({ hashes: Object.keys(hashes), algorithm: "sha1" }),
  });
  const vers = await r.json();
  const pids = [...new Set(Object.values(vers).map((v) => v.project_id))];
  const pr = await fetch(`https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(pids))}`, { headers: { "User-Agent": "Meitchouk/dashboard" } });
  const projects = Object.fromEntries((await pr.json()).map((p) => [p.id, p]));
  for (const [h, v] of Object.entries(vers)) {
    const p = projects[v.project_id];
    const m = mods[hashes[h]];
    if (!p || !m) continue;
    m.modrinth = `https://modrinth.com/mod/${p.slug}`;
    m.wiki = p.wiki_url || null;
    m.icon_url = p.icon_url || null;
    m.title = p.title;
  }
} catch (e) { console.warn("Modrinth no disponible:", e.message); }

// ---- vanilla: tags, encantamientos y nombres (el cliente 26.2 + indice de assets para es_mx) ----
const MC = process.env.MC_DIR || "C:/Users/User/curseforge/minecraft/Install";
const MCV = process.env.MC_VERSION || "26.2";
try {
  const vtmp = path.join(tmpRoot, "_vanilla");
  fs.mkdirSync(vtmp);
  try { execFileSync("unzip", ["-q", "-o", "-d", vtmp, path.join(MC, "versions", MCV, MCV + ".jar")], { stdio: "ignore" }); } catch { /* parcial */ }
  const vjson = readJson(path.join(MC, "versions", MCV, MCV + ".json"));
  const idx = readJson(path.join(MC, "assets", "indexes", vjson.assetIndex.id + ".json"));
  const h = idx.objects["minecraft/lang/es_mx.json"]?.hash;
  if (h) { fs.mkdirSync(path.join(vtmp, "assets/minecraft/lang"), { recursive: true }); fs.copyFileSync(path.join(MC, "assets", "objects", h.slice(0, 2), h), path.join(vtmp, "assets/minecraft/lang/es_mx.json")); }
  collectData(vtmp, "Minecraft");
} catch (e) { console.warn("vanilla no disponible:", e.message); }

const resolve = (ref, map, seen = new Set()) => {
  const out = new Set();
  for (const r of Array.isArray(ref) ? ref : [ref]) {
    if (typeof r !== "string") continue;
    if (r.startsWith("#")) { const t = r.slice(1); if (seen.has(t)) continue; seen.add(t); for (const v of map.get(t) ?? []) for (const x of resolve(v, map, seen)) out.add(x); }
    else out.add(r.includes(":") ? r : "minecraft:" + r);
  }
  return out;
};
const text = (d) => (typeof d === "string" ? d : d?.translate ? langEN[d.translate] ?? d.fallback ?? d.translate : d?.text ?? "");
const textES = (d) => (d?.translate ? langES[d.translate] : null);
const enchantments = [];
const coverage = [];
for (const [id, { json, mod }] of [...enchants].sort((a, b) => a[0].localeCompare(b[0]))) {
  const en = text(json.description) || id;
  const es = textES(json.description);
  enchantments.push({ id, en, ...(es && es !== en ? { es } : {}), max: json.max_level ?? 1, mod, ...(json.exclusive_set ? { ex: [...resolve(json.exclusive_set, enchTags)].filter((x) => x !== id) } : {}) });
  coverage.push(resolve(json.supported_items ?? [], itemTags));
}
const modItemIds = new Set(mods.flatMap((m) => m.items.map((i) => i.id)));
const itemEnch = {};
enchantments.forEach((e, i) => {
  for (const it of coverage[i]) {
    const isMod = modItemIds.has(it);
    if (!isMod && e.mod === "Minecraft") continue; // vanilla+vanilla ya lo cubre la pestaña Give normal
    if (!isMod && !it.startsWith("minecraft:")) continue;
    (itemEnch[it] ??= []).push(i);
  }
});

mods.sort((a, b) => (a.title ?? a.name).localeCompare(b.title ?? b.name));
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ generated: new Date().toISOString(), mods, enchantments, itemEnch }));
console.log(`${enchantments.length} encantamientos (${enchantments.filter((e) => e.mod !== "Minecraft").length} de mods), ${Object.keys(itemEnch).length} items con encantamientos`);
fs.rmSync(tmpRoot, { recursive: true, force: true });
const total = mods.reduce((n, m) => n + m.items.length, 0);
const withIcon = mods.reduce((n, m) => n + m.items.filter((i) => i.icon).length, 0);
console.log(`${mods.length} mods con items, ${total} items (${withIcon} con icono), ${mods.filter((m) => m.modrinth).length} enlazados a Modrinth`);
