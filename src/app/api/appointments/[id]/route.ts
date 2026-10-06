import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";

// Dono do agendamento — funciona antes e depois da migração profissional/terapeuta
function ownerOf(row: any): string {
  return row.professional_email ?? row.therapist_email ?? "";
}
function normEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function isValidEmail(v: string): boolean {
  const s = (v ?? "").trim();
  if (s.length < 6 || s.length > 120) return false;
  if (/\s/.test(s) || s.includes("..")) return false;
  if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(s)) return false;
  const [local, domain] = s.split("@");
  if (!local || !domain || !domain.includes(".")) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (domain.startsWith(".") || domain.startsWith("-") || domain.endsWith(".")) return false;
  return true;
}
function isValidPhone(v: string): boolean {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length < 10 || d.length > 13) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const ddd = d.length > 11 ? d.slice(2, 4) : d.slice(0, 2);
  if (ddd.startsWith("0")) return false;
  return true;
}

// Erro "função não encontrada / parâmetro desconhecido" = banco e código em versões diferentes
function signatureMismatch(msg: string): boolean {
  return /p_professional_email|p_therapist_email|could not find|schema cache|does not exist/i.test(msg);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("appointments").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  const sessionMail = normEmail(session.email);
  const existingOwner = normEmail(ownerOf(existing));
  if (!session.isAdmin && (!existingOwner || existingOwner !== sessionMail)) {
    return NextResponse.json({ error: "Sem permissão: este agendamento é de outro profissional." }, { status: 403 });
  }

  const body = await req.json();
  // Profissional comum não pode transferir o agendamento: o dono é mantido.
  const owner = session.isAdmin
    ? normEmail(body.professional_email ?? body.therapist_email ?? ownerOf(existing)) || sessionMail
    : existingOwner;

  const emailRaw = String(body.client_email ?? body.patient_email ?? "").trim();
  if (emailRaw && !isValidEmail(emailRaw)) {
    return NextResponse.json({ error: "Confira o e-mail do cliente: parece incompleto (ex: nome@email.com)." }, { status: 400 });
  }
  const phoneRaw = String(body.patient_whatsapp ?? "").trim();
  if (phoneRaw && !isValidPhone(phoneRaw)) {
    return NextResponse.json({ error: "Confira o WhatsApp: use DDD + número (ex: 47999998888)." }, { status: 400 });
  }

  const base = {
    p_id: id,
    p_title: body.title,
    p_patient_name: body.patient_name ?? null,
    p_patient_whatsapp: body.patient_whatsapp ?? null,
    p_patient_email: body.client_email ?? body.patient_email ?? null,
    p_room_id: body.modality === "online" ? null : body.room_id,
    p_modality: body.modality,
    p_category: body.category ?? "atendimento",
    p_start_at: body.start_at,
    p_end_at: body.end_at,
  };

  let { data, error } = await supabase.rpc("update_appointment", { ...base, p_professional_email: owner });
  if (error && signatureMismatch(error.message ?? "")) {
    const retry = await supabase.rpc("update_appointment", { ...base, p_therapist_email: owner });
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    const msg = error.message ?? "Erro ao atualizar";
    const status = msg.includes("Conflito") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("appointments").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const sessionMailDel = normEmail(session.email);
  const existingOwnerDel = normEmail(ownerOf(existing));
  if (!session.isAdmin && (!existingOwnerDel || existingOwnerDel !== sessionMailDel)) {
    return NextResponse.json({ error: "Sem permissão: este agendamento é de outro profissional." }, { status: 403 });
  }
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
