import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";
import { syncToGoogleCalendar } from "@/lib/google-sync";

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
function phoneDigits(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}
function isValidPhone(v: string): boolean {
  const d = phoneDigits(v);
  if (d.length < 10 || d.length > 13) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const ddd = d.length > 11 ? d.slice(2, 4) : d.slice(0, 2);
  if (ddd.startsWith("0")) return false;
  return true;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const supabase = getSupabaseAdmin();
  let q = supabase.from("appointments").select("*").order("start_at", { ascending: true });
  if (from) q = q.gte("start_at", from);
  if (to) q = q.lt("start_at", to);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Semana visível para todos: admin vê tudo; profissional vê os próprios
  // completos e os dos outros só como bloco "Reservado" (sem dados do cliente — LGPD).
  if (!session.isAdmin && rows) {
    const me = session.email.trim().toLowerCase();
    const redacted = (rows as any[]).map((a) => {
      const owner = String(a.professional_email ?? a.therapist_email ?? "").trim().toLowerCase();
      if (owner === me) return a;
      const isShared = a.category === "reuniao" || a.category === "evento";
      return {
        ...a,
        title: isShared ? a.title : "Reservado",
        patient_name: null,
        patient_whatsapp: null,
        client_email: null,
        patient_email: null,
      };
    });
    return NextResponse.json(redacted);
  }
  return NextResponse.json(rows ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  // profissional comum SEMPRE cria para si (ignora o campo enviado); admin pode escolher
  const sessionMail = String(session.email ?? "").trim().toLowerCase();
  const profEmail = session.isAdmin
    ? String(body.professional_email ?? body.therapist_email ?? session.email).trim().toLowerCase()
    : sessionMail;

  const emailRaw = String(body.client_email ?? body.patient_email ?? "").trim();
  if (emailRaw && !isValidEmail(emailRaw)) {
    return NextResponse.json({ error: "Confira o e-mail do cliente: parece incompleto (ex: nome@email.com)." }, { status: 400 });
  }
  const phoneRaw = String(body.patient_whatsapp ?? "").trim();
  if (phoneRaw && !isValidPhone(phoneRaw)) {
    return NextResponse.json({ error: "Confira o WhatsApp: use DDD + número (ex: 47999998888)." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const base = {
    p_title: body.title,
    p_patient_name: body.patient_name ?? null,
    p_patient_whatsapp: body.patient_whatsapp ?? null,
    p_patient_email: body.client_email ?? body.patient_email ?? null,
    p_room_id: body.modality === "online" ? null : body.room_id,
    p_modality: body.modality,
    p_category: body.category ?? "atendimento",
    p_start_at: body.start_at,
    p_end_at: body.end_at,
    p_created_by: session.email,
  };

  // Tenta o modelo novo (professional_email); se o banco ainda estiver no antigo, tenta therapist_email
  let { data, error } = await supabase.rpc("create_appointment", { ...base, p_professional_email: profEmail });
  if (error && /p_professional_email|p_therapist_email|could not find|does not exist/i.test(error.message ?? "")) {
    const retry = await supabase.rpc("create_appointment", { ...base, p_therapist_email: profEmail });
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    const msg = error.message ?? "Erro ao criar agendamento";
    const status = msg.includes("Conflito") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  // se tem e-mail do cliente ou é reunião, sincroniza com Google (60 + 30 min popup)
  // fire-and-forget: não falha o agendamento se o Google falhar
  const clientEmail: string | null = body.client_email ?? body.patient_email ?? null;
  const participants: string[] = Array.isArray(body.participants) ? body.participants : [];
  if (clientEmail || participants.length > 0) {
    try {
      const attendees = [clientEmail, ...participants, profEmail].filter(Boolean) as string[];
      const roomLabel = body.modality === "online" ? "Online" : body.room_id;
      const eventId = await syncToGoogleCalendar({
        summary: body.title,
        description: `${body.patient_name ? "Cliente: "+body.patient_name+"\\n" : ""}Sala: ${roomLabel} — Instituto RenovaSer`,
        start_at: body.start_at,
        end_at: body.end_at,
        attendees: [...new Set(attendees)],
      });
      if (eventId && data?.id) {
        await supabase.from("appointments").update({ google_event_id: eventId }).eq("id", data.id);
        (data as any).google_event_id = eventId;
      }
    } catch (e) {
      console.error("Google sync falhou:", e);
    }
  }

  return NextResponse.json(data, { status: 201 });
}
