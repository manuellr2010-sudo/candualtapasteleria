import "server-only";
import { createHash, createHmac, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { config, isProduction } from "./env";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export const SESSION_COOKIE = "candu_admin";
const SESSION_HOURS = 12;

/** Formato del hash: scrypt:N:r:p:salt(base64url):hash(base64url) — generado con `npm run admin:password`. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64url");
  const got = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 256 * 1024 * 1024,
  });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function authConfigured(): { ok: boolean; reason?: string } {
  if (!config.adminHash) return { ok: false, reason: "Falta ADMIN_PASSWORD_HASH en el servidor." };
  if (config.sessionSecret.length < 32) return { ok: false, reason: "SESSION_SECRET debe tener al menos 32 caracteres." };
  return { ok: true };
}

function sign(data: string): string {
  return createHmac("sha256", config.sessionSecret).update(data).digest("base64url");
}

/** Las sesiones se invalidan si cambia la contraseña (huella del hash dentro del token). */
function fingerprint(): string {
  return createHash("sha256").update(config.adminHash).digest("base64url").slice(0, 16);
}

export function createSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, f: fingerprint(), exp: Date.now() + SESSION_HOURS * 3600_000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !authConfigured().ok) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: number; f: string };
    return data.exp > Date.now() && data.f === fingerprint();
  } catch {
    return false;
  }
}

export async function setSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Para páginas y acciones del panel: redirige al acceso si no hay sesión válida. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/acceso");
}

/** Para rutas API del panel: además de la sesión, comprueba que la petición venga de este mismo sitio. */
export async function assertAdminApi(req: Request): Promise<Response | null> {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado" }, { status: 401 });
  const origin = req.headers.get("origin");
  if (origin) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host || new URL(origin).host !== host) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  }
  return null;
}

/* ── Límite de intentos de acceso (en memoria, por IP) ── */
type G = typeof globalThis & { __canduLogin?: Map<string, { n: number; until: number }> };
const g = globalThis as G;
const attempts = (g.__canduLogin ??= new Map());
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60_000;

export function loginBlocked(ip: string): number {
  const a = attempts.get(ip);
  if (!a) return 0;
  if (a.until < Date.now()) {
    attempts.delete(ip);
    return 0;
  }
  return a.n >= MAX_ATTEMPTS ? Math.ceil((a.until - Date.now()) / 60000) : 0;
}

export function registerFailedLogin(ip: string) {
  const a = attempts.get(ip);
  if (!a || a.until < Date.now()) attempts.set(ip, { n: 1, until: Date.now() + WINDOW_MS });
  else a.n += 1;
}

export function clearLoginAttempts(ip: string) {
  attempts.delete(ip);
}

/**
 * IP del cliente para los límites de intentos. Se prefieren las cabeceras que fija la plataforma
 * (Vercel las sobrescribe y el cliente no puede falsearlas). Detrás de Caddy ≥ 2.5 X-Forwarded-For
 * también la fija el proxy. Si la app se expone sin proxy, X-Forwarded-For lo controla el cliente.
 */
export function ipFromHeaders(h: Headers): string {
  const v = h.get("x-vercel-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0];
  return (v ?? "local").trim().slice(0, 64) || "local";
}

export async function clientIp(): Promise<string> {
  return ipFromHeaders(await headers());
}
