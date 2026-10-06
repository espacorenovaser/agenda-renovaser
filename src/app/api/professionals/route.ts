import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET — lista todos os usuários (admins + profissionais) para os dropdowns.
// Qualquer sessão logada pode ler; a escrita é só de admin.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  let { data, error } = await supabase
    .from("users")
    .select("email, name, role, whatsapp, area_atuacao")
    .order("role", { ascending: true })
    .order("name", { ascending: true });

  // banco ainda sem as colunas novas? lista ao menos nome + e-mail
  if (error && /whatsapp|area_atuacao|column|does not exist|schema cache/i.test(error.message ?? "")) {
    const retry = await supabase
      .from("users")
      .select("email, name, role")
      .order("role", { ascending: true })
      .order("name", { ascending: true });
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST — admin cadastra um profissional (nome + e-mail + whatsapp + área)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim() || email.split("@")[0]!;
  const whatsapp = String(body.whatsapp ?? "").replace(/\D/g, "").slice(0, 15) || null;
  const area_atuacao = String(body.area_atuacao ?? "").trim() || null;
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("users").select("email, role").eq("email", email).single();
  if (existing?.role === "admin") {
    return NextResponse.json({ error: "Este e-mail é de um admin e não pode ser alterado aqui." }, { status: 400 });
  }

  let { data, error } = await supabase
    .from("users")
    .upsert({ email, name, role: "profissional", whatsapp, area_atuacao }, { onConflict: "email" })
    .select()
    .single();
  // banco sem as colunas novas? regrava só nome+role e o SQL abaixo cria as colunas
  if (error && /whatsapp|area_atuacao|column|does not exist|schema cache/i.test(error.message ?? "")) {
    const retry = await supabase
      .from("users")
      .upsert({ email, name, role: "profissional" }, { onConflict: "email" })
      .select()
      .single();
    data = retry.data;
    error = retry.error;
    if (!error) {
      return NextResponse.json(
        { ...data, _aviso: "Salvo, mas rode o SQL de WhatsApp/área no Supabase para guardar esses campos." },
        { status: 201 }
      );
    }
  }
  // banco ainda no modelo antigo (check permite só 'terapeuta')? tenta o nome antigo
  if (error && /role_check|check constraint/i.test(error.message ?? "")) {
    const retry = await supabase
      .from("users")
      .upsert({ email, name, role: "terapeuta" }, { onConflict: "email" })
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    // dica direta quando for RLS: falta a service_role no servidor
    if (/row-level security|policy/i.test(error.message ?? "")) {
      return NextResponse.json(
        { error: "Bloqueado pelo RLS da tabela users. Configure SUPABASE_SERVICE_ROLE_KEY no .env.local e reinicie o npm run dev." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data, { status: 201 });
}

// PATCH — admin edita nome, whatsapp e área de um profissional
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const whatsapp = body.whatsapp !== undefined ? String(body.whatsapp ?? "").replace(/\D/g, "").slice(0, 15) || null : undefined;
  const area_atuacao = body.area_atuacao !== undefined ? String(body.area_atuacao ?? "").trim() || null : undefined;
  if (!EMAIL_RE.test(email) || !name) {
    return NextResponse.json({ error: "Informe e-mail e nome" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("users").select("email, role").eq("email", email).single();
  if (!existing) return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
  if (existing.role === "admin") return NextResponse.json({ error: "Admins não podem ser editados aqui." }, { status: 400 });

  const patch: Record<string, unknown> = { name };
  if (whatsapp !== undefined) patch.whatsapp = whatsapp;
  if (area_atuacao !== undefined) patch.area_atuacao = area_atuacao;

  let { data, error } = await supabase.from("users").update(patch).eq("email", email).select().single();
  if (error && /whatsapp|area_atuacao|column|does not exist|schema cache/i.test(error.message ?? "")) {
    const retry = await supabase.from("users").update({ name }).eq("email", email).select().single();
    data = retry.data;
    error = retry.error;
    if (!error) {
      return NextResponse.json(
        { ...data, _aviso: "Nome salvo, mas rode o SQL de WhatsApp/área no Supabase para guardar esses campos." }
      );
    }
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

// DELETE ?email= — admin exclui um profissional (os expedientes dele saem junto por cascade)
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Informe o e-mail" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("users").select("email, role").eq("email", email).single();
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (existing.role === "admin") return NextResponse.json({ error: "Admins não podem ser excluídos aqui." }, { status: 400 });

  const { error } = await supabase.from("users").delete().eq("email", email);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
