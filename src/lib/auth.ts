import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const ADMIN_EMAILS = new Set([
  "espacorenovaser@gmail.com",
  "claudirisrael@gmail.com",
  "mmgorete00@gmail.com",
  "clecimarchioro@gmail.com",
]);

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}

export interface Session {
  email: string;
  name: string;
  isAdmin: boolean;
}

const SESSION_COOKIE = "rs_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function getSessionSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return secret;
}

export function createSessionToken(session: Pick<Session, "email" | "name">): string {
  const payload = Buffer.from(
    JSON.stringify({ ...session, expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })
  ).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;

    const expected = createHmac("sha256", getSessionSecret()).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof session.email !== "string" ||
      typeof session.name !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Math.floor(Date.now() / 1000)
    ) return null;

    return { email: session.email, name: session.name, isAdmin: isAdmin(session.email) };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("Não autenticado");
  return s;
}

export function roleLabel(role: string): string {
  return role === "admin" ? "admin" : "profissional";
}
