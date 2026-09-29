import "server-only";
import { gunzipSync } from "node:zlib";

// Lector minimo de NBT binario (archivos .dat de jugador) y conversion a SNBT con el mismo formato que `data get`,
// para reutilizar parseInventory. Se usa cuando la salida de `data get` llega recortada ("...") por ser muy larga.

type Tag = { t: number; v: unknown };

export function readNbt(buf: Buffer): Tag {
  let b = buf;
  try { b = gunzipSync(buf); } catch { /* ya descomprimido */ }
  let i = 0;
  const u8 = () => b.readUInt8(i++);
  const str = () => { const n = b.readUInt16BE(i); i += 2; const s = b.toString("utf8", i, i + n); i += n; return s; };
  const payload = (t: number): unknown => {
    switch (t) {
      case 1: { const v = b.readInt8(i); i += 1; return v; }
      case 2: { const v = b.readInt16BE(i); i += 2; return v; }
      case 3: { const v = b.readInt32BE(i); i += 4; return v; }
      case 4: { const v = b.readBigInt64BE(i); i += 8; return v; }
      case 5: { const v = b.readFloatBE(i); i += 4; return v; }
      case 6: { const v = b.readDoubleBE(i); i += 8; return v; }
      case 7: { const n = b.readInt32BE(i); i += 4; const v = [...b.subarray(i, i + n)].map((x) => (x > 127 ? x - 256 : x)); i += n; return v; }
      case 8: return str();
      case 9: { const et = u8(); const n = b.readInt32BE(i); i += 4; const out: Tag[] = []; for (let k = 0; k < n; k++) out.push({ t: et, v: payload(et) }); return out; }
      case 10: { const o: Record<string, Tag> = {}; for (;;) { const tt = u8(); if (tt === 0) break; const name = str(); o[name] = { t: tt, v: payload(tt) }; } return o; }
      case 11: { const n = b.readInt32BE(i); i += 4; const v: number[] = []; for (let k = 0; k < n; k++) { v.push(b.readInt32BE(i)); i += 4; } return v; }
      case 12: { const n = b.readInt32BE(i); i += 4; const v: bigint[] = []; for (let k = 0; k < n; k++) { v.push(b.readBigInt64BE(i)); i += 8; } return v; }
      default: throw new Error(`NBT: tipo desconocido ${t}`);
    }
  };
  const t = u8();
  str(); // nombre de la raiz
  return { t, v: payload(t) };
}

const quote = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const key = (k: string) => (/^[A-Za-z0-9_.+-]+$/.test(k) ? k : quote(k));
const num = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

export function toSnbt(tag: Tag): string {
  const { t, v } = tag;
  switch (t) {
    case 1: return `${v}b`;
    case 2: return `${v}s`;
    case 3: return String(v);
    case 4: return `${v}L`;
    case 5: return `${num(v as number)}f`;
    case 6: return `${num(v as number)}d`;
    case 7: return `[B; ${(v as number[]).map((x) => `${x}B`).join(", ")}]`;
    case 8: return quote(v as string);
    case 9: return `[${(v as Tag[]).map(toSnbt).join(", ")}]`;
    case 10: return `{${Object.entries(v as Record<string, Tag>).map(([k, x]) => `${key(k)}: ${toSnbt(x)}`).join(", ")}}`;
    case 11: return `[I; ${(v as number[]).join(", ")}]`;
    case 12: return `[L; ${(v as bigint[]).map((x) => `${x}L`).join(", ")}]`;
    default: return "";
  }
}

export function child(tag: Tag, name: string): Tag | undefined {
  return tag.t === 10 ? (tag.v as Record<string, Tag>)[name] : undefined;
}
