import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSessionToken, isAdmin } from "@/lib/auth";
import { createOAuth2Client } from "@/lib/google";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");
  const stateCookie = req.cookies.get("rs_oauth_state")?.value;
  const stateIsValid = Boolean(
    state && stateCookie &&
    state.length === stateCookie.length &&
    timingSafeEqual(Buffer.from(state), Buffer.from(stateCookie))
  );
  if (!stateIsValid) {
    const response = NextResponse.json({ error: "Estado OAuth inválido ou expirado" }, { status: 400 });
    response.cookies.delete("rs_oauth_state");
    return response;
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    const response = NextResponse.json({ error: "Código de autorização não encontrado" }, { status: 400 });
    response.cookies.delete("rs_oauth_state");
    return response;
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();
    if (!profile.email) return NextResponse.json({ error: "E-mail não retornado" }, { status: 400 });

    const email = profile.email.toLowerCase();
    const name = profile.name || email;

    const supabase = getSupabaseAdmin();
    const user = {
      email,
      name,
      google_account_id: profile.id,
      google_access_token: tokens.access_token,
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      ...(tokens.refresh_token ? { google_refresh_token: tokens.refresh_token } : {}),
    };
    const { error: upsertError } = await supabase.from("users").upsert(
      user,
      { onConflict: "email" }
    );
    if (upsertError) throw upsertError;

    if (isAdmin(email)) {
      const { error: roleError } = await supabase.from("users").update({ role: "admin" }).eq("email", email);
      if (roleError) throw roleError;
    }

    const res = NextResponse.redirect(new URL("/?login=success", req.url));
    const secure = process.env.NODE_ENV === "production";
    res.cookies.delete("rs_oauth_state");
    res.cookies.set("rs_session", createSessionToken({ email, name }), {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      secure,
      sameSite: "lax",
    });
    return res;
  } catch (err: unknown) {
    console.error("Erro na autenticação:", err);
    const response = NextResponse.json({ error: "Não foi possível concluir o login" }, { status: 500 });
    response.cookies.delete("rs_oauth_state");
    return response;
  }
}
