import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";
import { isEventoTipo } from "@/lib/rooms";
import { deleteGoogleCalendarEvent, getGoogleEventGuests, syncToGoogleCalendar, updateGoogleCalendarEvent } from "@/lib/google-sync";
import { normalizeActionItems, normalizeMeetingEmails, normalizeReminderMinutes } from "@/lib/meeting-data";

type AppointmentRecord = {
  id: string;
  category: string;
  title: string;
  start_at: string;
  end_at: string;
  series_id?: string | null;
  google_event_id?: string | null;
  meeting_link?: string | null;
  professional_email?: string | null;
  therapist_email?: string | null;
  participants?: string[] | null;
  [key: string]: unknown;
};

type AppointmentConflict = Pick<AppointmentRecord, "id" | "start_at" | "end_at" | "professional_email" | "participants">;

// Dono do agendamento — funciona antes e depois da migração profissional/terapeuta
function ownerOf(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const appointment = row as Pick<AppointmentRecord, "professional_email" | "therapist_email">;
  return appointment.professional_email ?? appointment.therapist_email ?? "";
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

function canSeeMeetingDetails(session: { email: string; isAdmin: boolean }, appointment: AppointmentRecord): boolean {
  return session.isAdmin ||
    normEmail(ownerOf(appointment)) === normEmail(session.email) ||
    (appointment.participants ?? []).some((email: string) => normEmail(email) === normEmail(session.email));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: appointment, error } = await supabase.from("appointments").select("*").eq("id", id).single();
  if (error || !appointment) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  if (appointment.category !== "reuniao" || !canSeeMeetingDetails(session, appointment)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  if (!appointment.google_event_id) return NextResponse.json({ guests: [], calendar_link: null, meeting_link: appointment.meeting_link ?? null });

  try {
    const guests = await getGoogleEventGuests(appointment.google_event_id);
    return NextResponse.json({ guests, calendar_link: null, meeting_link: appointment.meeting_link ?? null });
  } catch (error) {
    console.error("Falha ao consultar respostas do Google Calendar:", error);
    return NextResponse.json({ error: "Não foi possível consultar os convites do Google." }, { status: 502 });
  }
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
  const participants = isMeeting
    ? body.participants === undefined ? appointmentArray(existing.participants) : normalizeMeetingEmails(body.participants)
    : [];
  const guestEmails = isMeeting
    ? body.guest_emails === undefined ? appointmentArray(existing.guest_emails) : normalizeMeetingEmails(body.guest_emails)
    : [];
  const actionItems = isMeeting
    ? body.action_items === undefined ? normalizeActionItems(existing.action_items ?? []) : normalizeActionItems(body.action_items)
    : [];
  const reminderMinutes = isMeeting
    ? body.reminder_minutes === undefined ? normalizeReminderMinutes(existing.reminder_minutes ?? [60, 30]) : normalizeReminderMinutes(body.reminder_minutes)
    : [60, 30];
  if (participants === null || guestEmails === null || actionItems === null || reminderMinutes === null) {
    return NextResponse.json({ error: "Confira participantes, convidados, lembretes e encaminhamentos." }, { status: 400 });
  }
  const textLimits = { meeting_type: 60, meeting_objective: 1000, meeting_agenda: 5000, private_notes: 5000, meeting_minutes: 10000 };
  for (const [field, limit] of Object.entries(textLimits)) {
    if (typeof body[field] === "string" && body[field].length > limit) {
      return NextResponse.json({ error: "Um dos campos da reunião excede o limite permitido." }, { status: 400 });
    }
  }
  const needsMeetingSchema = isMeeting || existing.category === "reuniao";
  if (needsMeetingSchema) {
    const { error: schemaError } = await supabase.from("appointments")
      .select("participants,guest_emails,meeting_type,meeting_objective,meeting_agenda,private_notes,meeting_minutes,action_items,reminder_minutes,series_id,recurrence_frequency,recurrence_index,recurrence_count")
      .limit(1);
    if (schemaError) {
      return NextResponse.json({ error: "A migração de reuniões do Supabase precisa ser aplicada antes de editar reuniões." }, { status: 503 });
    }
  }

  const metadata = {
    evento_tipo: eventoTipo,
    participants,
    guest_emails: guestEmails,
    meeting_type: isMeeting ? String(body.meeting_type ?? existing.meeting_type ?? "").trim() || null : null,
    meeting_objective: isMeeting ? String(body.meeting_objective ?? existing.meeting_objective ?? "").trim() || null : null,
    meeting_agenda: isMeeting ? String(body.meeting_agenda ?? existing.meeting_agenda ?? "").trim() || null : null,
    private_notes: isMeeting ? String(body.private_notes ?? existing.private_notes ?? "").trim() || null : null,
    meeting_minutes: isMeeting ? String(body.meeting_minutes ?? existing.meeting_minutes ?? "").trim() || null : null,
    action_items: isMeeting ? actionItems : [],
    reminder_minutes: isMeeting ? reminderMinutes : [60, 30],
  };

  const updateSeries = body.update_series === true && Boolean(existing.series_id);
  if (body.update_series === true && !existing.series_id) {
    return NextResponse.json({ error: "Este agendamento não pertence a uma série." }, { status: 400 });
  }
  const seriesRows = updateSeries
    ? (((await supabase.from("appointments").select("*").eq("series_id", existing.series_id).order("recurrence_index")).data ?? []) as AppointmentRecord[])
    : [existing as AppointmentRecord];
  if (updateSeries && seriesRows.length === 0) return NextResponse.json({ error: "Série não encontrada." }, { status: 404 });

  const startShift = new Date(body.start_at).getTime() - new Date(existing.start_at).getTime();
  const duration = new Date(body.end_at).getTime() - new Date(body.start_at).getTime();
  if (!Number.isFinite(startShift) || !Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: "Confira data e horários da reunião." }, { status: 400 });
  }
  const targets = updateSeries
    ? seriesRows.map((row) => {
      const start = new Date(new Date(row.start_at).getTime() + startShift);
      return { ...row, start_at: start.toISOString(), end_at: new Date(start.getTime() + duration).toISOString() };
    })
    : [{ ...existing, start_at: body.start_at, end_at: body.end_at }];

  if (isMeeting) {
    const participantsToCheck = new Set([owner, ...participants].map((email) => email.toLowerCase()));
      const targetIds = new Set(targets.map((row) => row.id));
      const starts = targets.map((row) => new Date(row.start_at).getTime());
      const ends = targets.map((row) => new Date(row.end_at).getTime());
    const from = new Date(Math.min(...starts)).toISOString();
    const to = new Date(Math.max(...ends)).toISOString();
    const { data: otherAppointments, error: conflictQueryError } = await supabase
      .from("appointments")
      .select("id,start_at,end_at,professional_email,participants")
      .lt("start_at", to)
      .gt("end_at", from);
    if (conflictQueryError) return NextResponse.json({ error: "Não foi possível verificar a disponibilidade dos participantes." }, { status: 500 });
    const hasConflict = targets.some((target) => ((otherAppointments ?? []) as AppointmentConflict[]).some((appointment) => {
      if (targetIds.has(appointment.id)) return false;
      const overlaps = new Date(appointment.start_at) < new Date(target.end_at) && new Date(appointment.end_at) > new Date(target.start_at);
      const ownerIsBusy = participantsToCheck.has(String(appointment.professional_email ?? "").toLowerCase());
      const participantIsBusy = (appointment.participants ?? []).some((email: string) => participantsToCheck.has(String(email).toLowerCase()));
      return overlaps && (ownerIsBusy || participantIsBusy);
    }));
    if (hasConflict) return NextResponse.json({ error: "Um dos participantes selecionados já tem outro compromisso nesse horário." }, { status: 409 });
  }

  let updatedRows: AppointmentRecord[] = [];
  if (updateSeries) {
    const { data, error } = await supabase.rpc("update_appointment_series", {
      p_series_id: existing.series_id,
      p_start_shift_seconds: startShift / 1000,
      p_duration_seconds: duration / 1000,
      p_title: body.title,
      p_patient_name: body.patient_name ?? null,
      p_patient_whatsapp: body.patient_whatsapp ?? null,
      p_patient_email: body.client_email ?? body.patient_email ?? null,
      p_room_id: roomId,
      p_modality: modality,
      p_category: category,
      p_professional_email: owner,
      p_meeting_metadata: metadata,
    });
    if (error) return NextResponse.json({ error: error.message ?? "Erro ao atualizar a série." }, { status: error.message?.includes("Conflito") ? 409 : 500 });
    updatedRows = Array.isArray(data) ? data as AppointmentRecord[] : data ? [data as AppointmentRecord] : [];
  } else {
    const base = {
      p_id: id,
      p_title: body.title,
      p_patient_name: body.patient_name ?? null,
      p_patient_whatsapp: body.patient_whatsapp ?? null,
      p_patient_email: body.client_email ?? body.patient_email ?? null,
      p_room_id: roomId,
      p_modality: modality,
      p_category: category,
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
      return NextResponse.json({ error: msg }, { status: msg.includes("Conflito") ? 409 : 400 });
    }
    const rowMetadata = needsMeetingSchema ? metadata : { evento_tipo: eventoTipo };
    const { error: metadataError } = await supabase.from("appointments").update(rowMetadata).eq("id", id);
    if (metadataError) return NextResponse.json({ error: "Não foi possível salvar os detalhes da reunião. Confirme se a migração de reuniões foi aplicada." }, { status: 500 });
    updatedRows = [((Array.isArray(data) ? data[0] : data) as AppointmentRecord)];
  }

  const attendeeEmails = [...new Set([
    ...(isMeeting ? [...participants, ...guestEmails] : [emailRaw]),
    owner,
  ].filter(Boolean))];
  const roomLabel = modality === "presencial" ? roomId : modality === "externo" ? "Local do cliente" : "Online";
  const description = [
    isMeeting && metadata.meeting_objective ? `Objetivo: ${metadata.meeting_objective}` : "",
    isMeeting && metadata.meeting_agenda ? `Pauta:\n${metadata.meeting_agenda}` : "",
    !isMeeting && body.patient_name ? `Cliente: ${body.patient_name}` : "",
    `Local: ${roomLabel} — Instituto RenovaSer`,
  ].filter(Boolean).join("\n\n");
  let calendarWarning: string | null = null;
  let calendarResult = null;
  const shouldSync = Boolean(existing.google_event_id) || isMeeting || Boolean(emailRaw);
  if (shouldSync) {
    for (const row of updatedRows) {
      try {
        const eventOptions = {
          summary: String(body.title ?? existing.title),
          description,
          start_at: String(row.start_at ?? body.start_at ?? existing.start_at),
          end_at: String(row.end_at ?? body.end_at ?? existing.end_at),
          attendees: attendeeEmails,
          reminderMinutes,
          onlineMeeting: modality === "online" && !row.meeting_link,
        };
        if (row.google_event_id) {
          calendarResult = await updateGoogleCalendarEvent(row.google_event_id, eventOptions);
        } else {
          calendarResult = await syncToGoogleCalendar(eventOptions);
        }
        if (calendarResult?.id) {
          await supabase.from("appointments").update({
            google_event_id: calendarResult.id,
            meeting_link: calendarResult.meetingLink ?? row.meeting_link ?? null,
          }).eq("id", row.id);
          row.google_event_id = calendarResult.id;
          row.meeting_link = calendarResult.meetingLink ?? row.meeting_link ?? null;
        } else {
          calendarWarning = "A reunião foi salva, mas não há uma conta Google Calendar conectada para enviar os convites.";
        }
      } catch (error) {
        console.error("Falha ao sincronizar alteração com Google Calendar:", error);
        calendarWarning = "A reunião foi salva, mas os convites do Google não foram atualizados.";
      }
    }
  }

  return NextResponse.json({ ...updatedRows[0], ...metadata, occurrences: updatedRows, calendar_warning: calendarWarning });
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
  const scope = req.nextUrl.searchParams.get("scope");
  const rows = scope === "series" && existing.series_id
    ? (await supabase.from("appointments").select("id,google_event_id").eq("series_id", existing.series_id)).data ?? []
    : [{ id, google_event_id: existing.google_event_id }];
  try {
    for (const row of rows) {
      if (row.google_event_id) await deleteGoogleCalendarEvent(row.google_event_id);
    }
  } catch (error) {
    console.error("Falha ao cancelar convite Google:", error);
    return NextResponse.json({ error: "Não foi possível cancelar os convites do Google. O agendamento foi mantido." }, { status: 502 });
  }
  const ids = rows.map((row) => row.id);
  const { error } = await supabase.from("appointments").delete().in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function appointmentArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
