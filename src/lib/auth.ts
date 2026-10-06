import { cookies } from "next/headers";

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

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const email = jar.get("rs_session_email")?.value;
  const name = jar.get("rs_session_name")?.value;
  if (!email) return null;
  return { email, name: name ?? email, isAdmin: isAdmin(email) };
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("Não autenticado");
  return s;
}

export function roleLabel(role: string): string {
  return role === "admin" ? "admin" : "profissional";
}
