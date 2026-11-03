import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";
import { syncToGoogleCalendar } from "@/lib/google-sync";
import { isEventoCuidado, isEventoTipo } from "@/lib/rooms";
import { normalizeActionItems, normalizeEventAttendees, normalizeMeetingEmails, normalizeReminderMinutes, recurringTimes } from "@/lib/meeting-data";
import { randomUUID } from "node:crypto";

type AppointmentVisibilityRow = {
  professional_email?: string | null;
  therapist_email?: string | null;
  participants?: string[] | null;
  event_professionals?: string[] | null;
  category: string;
  title: string;
  [key: string]: unknown;
};

type AppointmentConflictRow = {
  start_at: string;
  end_at: string;
  professional_email?: string | null;
  participants?: string[] | null;
  event_professionals?: string[] | null;
};

type CreatedAppointment = {
  id: string;
  start_at?: string;
  end_at?: string;
  [key: string]: unknown;
};

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
    const redacted = (rows as AppointmentVisibilityRow[]).map((a) => {
      const owner = String(a.professional_email ?? a.therapist_email ?? "").trim().toLowerCase();
      const meetingParticipant = (a.participants ?? []).some((email: string) => String(email).trim().toLowerCase() === me);
      if (owner === me) return a;
      const isShared = a.category === "reuniao" || a.category === "evento";
      if (a.category === "reuniao" && meetingParticipant) {
        return { ...a, private_notes: null };
      }
      const eventFacilitator = (a.event_professionals ?? []).some((email: string) => String(email).trim().toLowerCase() === me);
      if (a.category === "evento" && eventFacilitator) return a;
      return {
        ...a,
        title: isShared ? a.title : "Reservado",
        patient_name: null,
        patient_whatsapp: null,
        client_email: null,
        patient_email: null,
        participants: [],
        guest_emails: [],
        meeting_type: null,
        meeting_objective: null,
        meeting_agenda: null,
        private_notes: null,
        meeting_minutes: null,
        action_items: [],
        meeting_link: null,
        google_event_id: null,
        event_professionals: [],
        event_attendees: [],
        event_description: null,
        event_care_type: null,
        event_capacity: null,
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

  const modality = String(body.modality ?? "presencial");
  if (!["presencial", "online", "externo"].includes(modality)) {
    return NextResponse.json({ error: "Modalidade inválida." }, { status: 400 });
  }
  const roomId = modality === "presencial" ? body.room_id ?? null : null;
  if (modality === "presencial" && !roomId) {
    return NextResponse.json({ error: "Agendamento presencial exige sala." }, { status: 400 });
  }
  const emailRaw = String(body.client_email ?? body.patient_email ?? "").trim();
  if (emailRaw && !isValidEmail(emailRaw)) {
    return NextResponse.json({ error: "Confira o e-mail do cliente: parece incompleto (ex: nome@email.com)." }, { status: 400 });
  }
  const phoneRaw = String(body.patient_whatsapp ?? "").trim();
  if (phoneRaw && !isValidPhone(phoneRaw)) {
    return NextResponse.json({ error: "Confira o WhatsApp: use só números com DDD (ex: 47999998888)." }, { status: 400 });
  }

  const category = String(body.category ?? "atendimento");
  const eventoTipoRaw = body.evento_tipo ?? null;
  if (eventoTipoRaw && !isEventoTipo(eventoTipoRaw)) {
    return NextResponse.json({ error: "Tipo de evento inválido." }, { status: 400 });
  }
  if (category === "evento" && !eventoTipoRaw) {
    return NextResponse.json({ error: "Escolha o tipo do evento (Curso, Treinamento, Formação, Workshop ou Atendimento em grupo)." }, { status: 400 });
  }
  const eventoTipo = category === "evento" ? eventoTipoRaw : null;
  const isMeeting = category === "reuniao";
  const isEvent = category === "evento";
  const participants = isMeeting ? normalizeMeetingEmails(body.participants ?? []) : [];
  const guestEmails = isMeeting ? normalizeMeetingEmails(body.guest_emails ?? []) : [];
  const actionItems = isMeeting ? normalizeActionItems(body.action_items ?? []) : [];
  const reminderMinutes = isMeeting ? normalizeReminderMinutes(body.reminder_minutes) : [60, 30];
  const eventProfessionals = isEvent ? normalizeMeetingEmails(body.event_professionals ?? []) : [];
  const eventAttendees = isEvent ? normalizeEventAttendees(body.event_attendees ?? []) : [];
  const eventCapacity = isEvent && body.event_capacity !== null && body.event_capacity !== undefined ? Number(body.event_capacity) : null;
  const eventCareType = isEvent && eventoTipo === "atendimento_grupo" && body.event_care_type ? String(body.event_care_type) : null;
  if (
    participants === null || guestEmails === null || actionItems === null || reminderMinutes === null ||
    eventProfessionals === null || eventAttendees === null ||
    (eventCapacity !== null && (!Number.isInteger(eventCapacity) || eventCapacity < eventAttendees.length || eventCapacity > 10000))
  ) {
    return NextResponse.json({ error: "Confira participantes, convidados, lembretes e encaminhamentos." }, { status: 400 });
  }
  if (isEvent && eventoTipo === "atendimento_grupo" && (!eventCareType || !isEventoCuidado(eventCareType))) {
    return NextResponse.json({ error: "Escolha o tipo de cuidado para o atendimento em grupo." }, { status: 400 });
  }
  if (eventCareType && !isEventoCuidado(eventCareType)) {
    return NextResponse.json({ error: "Tipo de cuidado inválido." }, { status: 400 });
  }
  const recurrenceAllowed = isMeeting || isEvent;
  const frequency = recurrenceAllowed && ["daily", "weekly", "monthly"].includes(body.recurrence_frequency)
    ? body.recurrence_frequency as "daily" | "weekly" | "monthly"
    : null;
  const occurrenceCount = frequency ? Number(body.recurrence_count) : 1;
  const maximumOccurrences = isEvent ? 30 : 12;
  if (!Number.isInteger(occurrenceCount) || occurrenceCount < 1 || occurrenceCount > maximumOccurrences || (frequency && occurrenceCount < 2)) {
    return NextResponse.json({ error: `Escolha entre 2 e ${maximumOccurrences} ocorrências para a recorrência.` }, { status: 400 });
  }
  const textLimits = { meeting_type: 60, meeting_objective: 1000, meeting_agenda: 5000, private_notes: 5000, meeting_minutes: 10000, event_description: 3000 };
  for (const [field, limit] of Object.entries(textLimits)) {
    if (typeof body[field] === "string" && body[field].length > limit) {
      return NextResponse.json({ error: "Um dos campos da reunião excede o limite permitido." }, { status: 400 });
    }
  }

  const supabase = getSupabaseAdmin();
  if (isMeeting || isEvent) {
    const { error: schemaError } = await supabase.from("appointments")
      .select("participants,guest_emails,meeting_type,meeting_objective,meeting_agenda,private_notes,meeting_minutes,action_items,reminder_minutes,series_id,recurrence_frequency,recurrence_index,recurrence_count,event_professionals,event_attendees,event_description,event_care_type,event_capacity")
      .limit(1);
    if (schemaError) {
      return NextResponse.json({ error: "A migração de reuniões e eventos do Supabase precisa ser aplicada antes de criar este agendamento." }, { status: 503 });
    }
  }
  const base = {
    p_title: body.title,
    p_patient_name: isMeeting || isEvent ? null : body.patient_name ?? null,
    p_patient_whatsapp: isMeeting || isEvent ? null : body.patient_whatsapp ?? null,
    p_patient_email: isMeeting || isEvent ? null : body.client_email ?? body.patient_email ?? null,
    p_room_id: roomId,
    p_modality: modality,
    p_category: category,
    p_start_at: body.start_at,
    p_end_at: body.end_at,
    p_created_by: session.email,
  };

  const times = frequency
    ? recurringTimes(String(body.start_at), String(body.end_at), frequency, occurrenceCount)
    : [{ start_at: String(body.start_at), end_at: String(body.end_at) }];
  const seriesId = frequency ? randomUUID() : null;
  if (isMeeting || isEvent) {
    const participantsToCheck = new Set([profEmail, ...participants, ...eventProfessionals].map((email) => email.toLowerCase()));
    const from = times[0].start_at;
    const to = times[times.length - 1].end_at;
    const { data: existingAppointments, error: conflictQueryError } = await supabase
      .from("appointments")
      .select("start_at,end_at,professional_email,participants,event_professionals")
      .lt("start_at", to)
      .gt("end_at", from);
    if (conflictQueryError) return NextResponse.json({ error: "Não foi possível verificar a disponibilidade dos participantes." }, { status: 500 });
    const conflict = times.find((time) => ((existingAppointments ?? []) as AppointmentConflictRow[]).some((appointment) => {
      const overlaps = new Date(appointment.start_at) < new Date(time.end_at) && new Date(appointment.end_at) > new Date(time.start_at);
      const ownerIsBusy = participantsToCheck.has(String(appointment.professional_email ?? "").toLowerCase());
      const participantIsBusy = (appointment.participants ?? []).some((email: string) => participantsToCheck.has(String(email).toLowerCase()));
      const eventProfessionalIsBusy = (appointment.event_professionals ?? []).some((email: string) => participantsToCheck.has(String(email).toLowerCase()));
      return overlaps && (ownerIsBusy || participantIsBusy || eventProfessionalIsBusy);
    }));
    if (conflict) return NextResponse.json({ error: "Um dos participantes selecionados já tem outro compromisso nesse horário." }, { status: 409 });
  }
  const created: CreatedAppointment[] = [];
  for (let index = 0; index < times.length; index++) {
    const rpcBase = { ...base, p_start_at: times[index].start_at, p_end_at: times[index].end_at };
    let { data, error } = await supabase.rpc("create_appointment", { ...rpcBase, p_professional_email: profEmail });
    if (error && /p_professional_email|p_therapist_email|could not find|does not exist/i.test(error.message ?? "")) {
      const retry = await supabase.rpc("create_appointment", { ...rpcBase, p_therapist_email: profEmail });
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      if (created.length) await supabase.from("appointments").delete().in("id", created.map((row) => row.id));
      const msg = error.message ?? "Erro ao criar agendamento";
      return NextResponse.json({ error: msg }, { status: msg.includes("Conflito") ? 409 : 400 });
    }
    const row = (Array.isArray(data) ? data[0] : data) as CreatedAppointment | null;
    if (row?.id) created.push(row);
  }

  const metadata = {
    evento_tipo: eventoTipo,
    participants,
    guest_emails: guestEmails,
    meeting_type: isMeeting ? String(body.meeting_type ?? "").trim() || null : null,
    meeting_objective: isMeeting ? String(body.meeting_objective ?? "").trim() || null : null,
    meeting_agenda: isMeeting ? String(body.meeting_agenda ?? "").trim() || null : null,
    private_notes: isMeeting ? String(body.private_notes ?? "").trim() || null : null,
    meeting_minutes: isMeeting ? String(body.meeting_minutes ?? "").trim() || null : null,
    action_items: isMeeting ? actionItems : [],
    reminder_minutes: isMeeting ? reminderMinutes : [60, 30],
    event_professionals: isEvent ? eventProfessionals : [],
    event_attendees: isEvent ? eventAttendees : [],
    event_description: isEvent ? String(body.event_description ?? "").trim() || null : null,
    event_care_type: isEvent ? eventCareType : null,
    event_capacity: isEvent ? eventCapacity : null,
    series_id: seriesId,
    recurrence_frequency: frequency,
    recurrence_index: frequency ? 1 : null,
    recurrence_count: frequency ? occurrenceCount : null,
  };
  let calendarWarning: string | null = null;
  for (let index = 0; index < created.length; index++) {
    const occurrenceMetadata = { ...metadata, ...(frequency ? { recurrence_index: index + 1 } : {}) };
    const rowMetadata = isMeeting || isEvent ? occurrenceMetadata : { evento_tipo: eventoTipo };
    const { error } = await supabase.from("appointments").update(rowMetadata).eq("id", created[index].id);
    if (error) {
      await supabase.from("appointments").delete().in("id", created.map((row) => row.id));
      return NextResponse.json({ error: "Não foi possível salvar os detalhes. Confirme se a migração de reuniões/eventos foi aplicada." }, { status: 500 });
    }
    created[index] = { ...created[index], ...rowMetadata };
  }

  for (let index = 0; index < created.length; index++) {
    const row = created[index];
    const clientEmail: string | null = body.client_email ?? body.patient_email ?? null;
    const eventEmails = eventAttendees.map((attendee) => attendee.email).filter((email): email is string => Boolean(email));
    const eventStaffEmails = eventProfessionals;
    const attendees = [...new Set([clientEmail, ...guestEmails, ...participants, ...eventEmails, ...eventStaffEmails, profEmail].filter(Boolean) as string[])];
    if (!isMeeting && !isEvent && !clientEmail) continue;
    try {
      const roomLabel = modality === "presencial" ? body.room_id : modality === "externo" ? "Local do cliente" : "Online";
      const description = [
        isEvent && body.event_description ? String(body.event_description) : "",
        isMeeting && body.meeting_objective ? `Objetivo: ${body.meeting_objective}` : "",
        isMeeting && body.meeting_agenda ? `Pauta:\n${body.meeting_agenda}` : "",
        !isMeeting && !isEvent && body.patient_name ? `Cliente: ${body.patient_name}` : "",
        `Local: ${roomLabel} — Instituto RenovaSer`,
      ].filter(Boolean).join("\n\n");
      const event = await syncToGoogleCalendar({
        summary: body.title,
        description,
        start_at: row.start_at ?? times[index].start_at,
        end_at: row.end_at ?? times[index].end_at,
        attendees,
        reminderMinutes: isMeeting ? reminderMinutes : [60, 30],
        onlineMeeting: modality === "online",
      });
      if (event?.id) {
        await supabase.from("appointments").update({ google_event_id: event.id, meeting_link: event.meetingLink }).eq("id", row.id);
        created[index] = { ...row, google_event_id: event.id, meeting_link: event.meetingLink };
      } else {
        calendarWarning = "O agendamento foi salvo, mas não há uma conta Google Calendar conectada para enviar os convites.";
      }
    } catch (e) {
      console.error("Google sync falhou:", e);
      calendarWarning = "O agendamento foi salvo, mas não foi possível enviar os convites do Google Calendar.";
    }
  }

  return NextResponse.json({ ...created[0], occurrences: created, calendar_warning: calendarWarning }, { status: 201 });
}
