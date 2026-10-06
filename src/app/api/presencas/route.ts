import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const date = req.nextUrl.searchParams.get("date");
  const supabase = getSupabaseAdmin();
  let q = supabase.from("presencas").select("*").order("start_at");
  if (date) q = q.eq("date", date);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const body = await req.json();
  // profissional comum só marca para si; admin pode marcar para qualquer um
  const email = session.isAdmin && body.professional_email ? body.professional_email : session.email;
  if (!body.date || !body.start_at || !body.end_at) return NextResponse.json({ error: "Informe data, início e fim" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("presencas").insert({
    professional_email: email,
    date: body.date,
    start_at: body.start_at,
    end_at: body.end_at,
    observacao: body.observacao ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Informe id" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("presencas").select("professional_email").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (!session.isAdmin && existing.professional_email !== session.email) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  await supabase.from("presencas").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
