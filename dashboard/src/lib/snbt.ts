// Parser minimo de SNBT (el formato que imprime `data get`): compounds, listas, arrays tipados,
// strings con/sin comillas y numeros con sufijo (1b, 2s, 3L, 1.5f, 2.0d).
export type Snbt = string | number | boolean | Snbt[] | { [k: string]: Snbt };
// Cada compound lleva (no enumerable) el texto SNBT original de cada valor, para poder reconstruirlo exacto
export const RAW = Symbol("raw");
export const rawOf = (o: unknown): Record<string, string> => ((o as { [RAW]?: Record<string, string> })?.[RAW]) ?? {};

export function parseSnbt(src: string): Snbt {
  let i = 0;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const fail = (m: string): never => { throw new Error(`SNBT: ${m} en pos ${i}`); };

  const str = (): string => {
    const q = src[i++];
    let out = "";
    while (i < src.length && src[i] !== q) {
      if (src[i] === "\\") { i++; }
      out += src[i++];
    }
    if (src[i] !== q) fail("string sin cerrar");
    i++;
    return out;
  };

  const bare = (allowColon = true): string => {
    const s = i;
    const re = allowColon ? /[A-Za-z0-9_\-.+:]/ : /[A-Za-z0-9_\-.+]/;
    while (i < src.length && re.test(src[i])) i++;
    if (s === i) fail(`caracter inesperado '${src[i]}'`);
    return src.slice(s, i);
  };

  const scalar = (): Snbt => {
    const t = bare();
    if (t === "true") return true;
    if (t === "false") return false;
    const m = t.match(/^(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)([bBsSlLfFdD])?$/);
    if (m) return Number(m[1]);
    return t; // identificador sin comillas (ej. minecraft:stone)
  };

  const value = (): Snbt => {
    ws();
    const c = src[i];
    if (c === "{") return compound();
    if (c === "[") return list();
    if (c === '"' || c === "'") return str();
    return scalar();
  };

  const compound = (): { [k: string]: Snbt } => {
    i++; // {
    const out: { [k: string]: Snbt } = {};
    const raw: Record<string, string> = {};
    Object.defineProperty(out, RAW, { value: raw, enumerable: false });
    ws();
    if (src[i] === "}") { i++; return out; }
    for (;;) {
      ws();
      const key = src[i] === '"' || src[i] === "'" ? str() : bare(false);
      ws();
      if (src[i] !== ":") fail("se esperaba ':'");
      i++;
      ws();
      const vs = i;
      out[key] = value();
      raw[key] = src.slice(vs, i).trim();
      ws();
      if (src[i] === ",") { i++; continue; }
      if (src[i] === "}") { i++; return out; }
      fail("se esperaba ',' o '}'");
    }
  };

  const list = (): Snbt[] => {
    i++; // [
    ws();
    // arrays tipados: [B; 1b, 2b] / [I; 1, 2] / [L; ...]
    if (/[BIL]/.test(src[i]) && src[i + 1] === ";") i += 2;
    const out: Snbt[] = [];
    ws();
    if (src[i] === "]") { i++; return out; }
    for (;;) {
      out.push(value());
      ws();
      if (src[i] === ",") { i++; continue; }
      if (src[i] === "]") { i++; return out; }
      fail("se esperaba ',' o ']'");
    }
  };

  const v = value();
  return v;
}

export type InvSlot = { slot: number; id: string; count: number; enchants: Record<string, number>; name?: string; extra: string[]; spec: string };

// Normaliza la lista Inventory de `data get` a algo comodo para la UI (soporta componentes 1.20.5+ y NBT viejo)
export function parseInventory(raw: string): InvSlot[] {
  const list = parseSnbt(raw);
  if (!Array.isArray(list)) return [];
  return list.map((e) => {
    const o = e as { [k: string]: Snbt };
    const comps = (o.components ?? {}) as { [k: string]: Snbt };
    const tag = (o.tag ?? {}) as { [k: string]: Snbt };
    const enchants: Record<string, number> = {};
    const ce = comps["minecraft:enchantments"] as { [k: string]: Snbt } | undefined;
    const levels = (ce && typeof ce === "object" && !Array.isArray(ce) ? ((ce as { levels?: Snbt }).levels ?? ce) : undefined) as { [k: string]: Snbt } | undefined;
    if (levels && typeof levels === "object" && !Array.isArray(levels)) for (const [k, v] of Object.entries(levels)) enchants[k.replace(/^minecraft:/, "")] = Number(v);
    const oldEnch = tag.Enchantments as Snbt[] | undefined;
    if (Array.isArray(oldEnch)) for (const x of oldEnch) { const c = x as { [k: string]: Snbt }; enchants[String(c.id).replace(/^minecraft:/, "")] = Number(c.lvl); }
    let name: string | undefined;
    const cn = comps["minecraft:custom_name"];
    if (typeof cn === "string") { try { const j = JSON.parse(cn); name = typeof j === "string" ? j : j?.text; } catch { name = cn; } }
    const extra = Object.keys(comps).filter((k) => !["minecraft:enchantments", "minecraft:custom_name"].includes(k)).map((k) => k.replace(/^minecraft:/, ""));
    // spec = argumento de /give que reproduce el objeto exacto: id[comp=valor,...] (1.20.5+) o id{nbt} (antiguo)
    const fullId = String(o.id ?? "");
    const compRaw = rawOf(comps);
    const compEntries = Object.entries(compRaw).map(([k, v]) => `${k.replace(/^"|"$/g, "")}=${v}`);
    const tagRaw = rawOf(o).tag;
    const spec = compEntries.length ? `${fullId}[${compEntries.join(",")}]` : tagRaw ? `${fullId}${tagRaw}` : fullId;
    return { slot: Number(o.Slot ?? 0), id: fullId.replace(/^minecraft:/, ""), count: Number(o.count ?? o.Count ?? 1), enchants, name, extra, spec };
  });
}
