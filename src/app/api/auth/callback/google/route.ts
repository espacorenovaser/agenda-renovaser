import { NextRequest, NextResponse } from "next/server";
import { oauth2Client } from "@/lib/google";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Código de autorização não encontrado" }, { status: 400 });

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();
    if (!profile.email) return NextResponse.json({ error: "E-mail não retornado" }, { status: 400 });

    const email = profile.email.toLowerCase();
    const name = profile.name || email;

    const supabase = getSupabaseAdmin();
    await supabase.from("users").upsert(
      {
        email,
        name,
        google_account_id: profile.id,
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      },
      { onConflict: "email" }
    );

    // garante que admins tenham role=admin (mesmo que a tabela já existia)
    const admins = ["espacorenovaser@gmail.com", "claudirisrael@gmail.com", "mmgorete00@gmail.com", "clecimarchioro@gmail.com"];
    if (admins.includes(email)) {
      await supabase.from("users").update({ role: "admin" }).eq("email", email);
    }

    const res = NextResponse.redirect(new URL("/?login=success", req.url));
    const maxAge = 60 * 60 * 24 * 30; // 30 dias
    const secure = process.env.NODE_ENV === "production";
    res.cookies.set("rs_session_email", email, { httpOnly: true, maxAge, path: "/", secure, sameSite: "lax" });
    res.cookies.set("rs_session_name", name, { httpOnly: true, maxAge, path: "/", secure, sameSite: "lax" });
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro na autenticação:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
