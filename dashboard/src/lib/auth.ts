import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/firebase";
import { ExarotonError } from "@/lib/exaroton";

// Usuarios en Firestore (users/<username>). Cualquiera puede registrarse; solo entra quien este aprobado por un admin.
export type Role = "admin" | "user";
export type User = {
  username: string;
  role: Role;
  approved: boolean;
  createdAt: number;
  approvedAt?: number | null;
  approvedBy?: string | null;
  lastLogin?: number | null;
};
type UserDoc = User & { hash: string; salt: string };

export type Session = { username: string; role: Role };

export const COOKIE = "exa_session";
const SESSION_DAYS = 7;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new ExarotonError("Falta AUTH_SECRET (32+ caracteres) en .env.local", 500);
  return new TextEncoder().encode(s);
}

export const normalizeUsername = (u: string) => u.trim().toLowerCase();
export const validUsername = (u: string) => /^[a-z0-9_.-]{3,24}$/.test(u);

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}
export function verifyPassword(password: string, salt: string, hash: string) {
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

function usersCol() {
  const d = db();
  if (!d) throw new ExarotonError("Firestore no esta configurado (falta la clave de servicio)", 503);
  return d.collection("users");
}

const pub = (u: UserDoc): User => ({ username: u.username, role: u.role, approved: u.approved, createdAt: u.createdAt, approvedAt: u.approvedAt ?? null, approvedBy: u.approvedBy ?? null, lastLogin: u.lastLogin ?? null });

export async function getUser(username: string): Promise<UserDoc | null> {
  const snap = await usersCol().doc(normalizeUsername(username)).get();
  return snap.exists ? (snap.data() as UserDoc) : null;
}

export async function listUsers(): Promise<User[]> {
  const q = await usersCol().orderBy("createdAt", "desc").get();
  return q.docs.map((d) => pub(d.data() as UserDoc));
}

export async function createUser(username: string, password: string, opts: Partial<Pick<User, "role" | "approved">> = {}): Promise<User> {
  const u = normalizeUsername(username);
  if (!validUsername(u)) throw new ExarotonError("Usuario invalido: 3-24 caracteres, letras, numeros, . _ -", 400);
  if (password.length < 8) throw new ExarotonError("La contraseña debe tener al menos 8 caracteres", 400);
  if (await getUser(u)) throw new ExarotonError("Ese usuario ya existe", 409);
  const { salt, hash } = hashPassword(password);
  const doc: UserDoc = { username: u, role: opts.role ?? "user", approved: opts.approved ?? false, createdAt: Date.now(), salt, hash, approvedAt: opts.approved ? Date.now() : null, approvedBy: opts.approved ? "seed" : null, lastLogin: null };
  await usersCol().doc(u).set(doc);
  return pub(doc);
}

export async function updateUser(username: string, patch: Partial<Pick<User, "role" | "approved" | "approvedBy">> & { password?: string }): Promise<User> {
  const u = normalizeUsername(username);
  const cur = await getUser(u);
  if (!cur) throw new ExarotonError("Usuario no encontrado", 404);
  const data: Partial<UserDoc> = {};
  if (patch.role) data.role = patch.role;
  if (patch.approved !== undefined) { data.approved = patch.approved; data.approvedAt = patch.approved ? Date.now() : null; data.approvedBy = patch.approved ? (patch.approvedBy ?? null) : null; }
  if (patch.password) { if (patch.password.length < 8) throw new ExarotonError("La contraseña debe tener al menos 8 caracteres", 400); Object.assign(data, hashPassword(patch.password)); }
  await usersCol().doc(u).set(data, { merge: true });
  invalidateApproval(u);
  return pub({ ...cur, ...data } as UserDoc);
}

export async function deleteUser(username: string) {
  await usersCol().doc(normalizeUsername(username)).delete();
  invalidateApproval(username);
}

// Login: devuelve el usuario si las credenciales son correctas (aprobado o no; la aprobacion solo limita el uso del servidor del admin)
export async function authenticate(username: string, password: string): Promise<User> {
  const u = await getUser(username);
  if (!u || !verifyPassword(password, u.salt, u.hash)) throw new ExarotonError("Usuario o contraseña incorrectos", 401);
  await usersCol().doc(u.username).set({ lastLogin: Date.now() }, { merge: true });
  return pub(u);
}

// ---- Sesion (JWT firmado en cookie httpOnly) ----
export async function createSessionToken(s: Session) {
  return new SignJWT({ role: s.role }).setProtectedHeader({ alg: "HS256" }).setSubject(s.username).setIssuedAt().setExpirationTime(`${SESSION_DAYS}d`).sign(secret());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return { username: payload.sub, role: (payload.role as Role) ?? "user" };
  } catch { return null; }
}

export async function setSessionCookie(s: Session) {
  const token = await createSessionToken(s);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 86400 });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export async function currentSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function requireSession(): Promise<Session> {
  const s = await currentSession();
  if (!s) throw new ExarotonError("No has iniciado sesion", 401);
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== "admin") throw new ExarotonError("Solo el administrador puede hacer esto", 403);
  return s;
}

// Aprobacion con cache corta (evita una lectura de Firestore por peticion)
const approvedCache = new Map<string, { v: boolean; at: number }>();
export async function isApproved(username: string): Promise<boolean> {
  const u = normalizeUsername(username);
  const c = approvedCache.get(u);
  if (c && Date.now() - c.at < 30000) return c.v;
  const doc = await getUser(u).catch(() => null);
  const v = !!doc?.approved;
  approvedCache.set(u, { v, at: Date.now() });
  return v;
}
export const invalidateApproval = (username: string) => approvedCache.delete(normalizeUsername(username));
