"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { ROOMS, getRoom, ONLINE_ROOM_LABEL, EXTERNO_ROOM_LABEL, EVENTO_TIPOS, EVENTO_CUIDADOS, eventoLabel } from "@/lib/rooms";
import { formatWhatsAppLink } from "@/lib/whatsapp";
import type { Session } from "@/lib/auth";

type Appointment = {
  id: string;
  title: string;
  patient_name: string | null;
  patient_whatsapp: string | null;
  client_email: string | null;
  patient_email?: string | null;
  room_id: string | null;
  modality: "presencial" | "online" | "externo";
  category: string;
  evento_tipo?: string | null;
  professional_email: string;
  therapist_email?: string;
  start_at: string;
  end_at: string;
  participants?: string[];
  guest_emails?: string[];
  meeting_type?: string | null;
  meeting_objective?: string | null;
  meeting_agenda?: string | null;
  private_notes?: string | null;
  meeting_minutes?: string | null;
  action_items?: { id: string; text: string; owner_email: string | null; due_date: string | null; done: boolean }[];
  reminder_minutes?: number[];
  meeting_link?: string | null;
  google_event_id?: string | null;
  series_id?: string | null;
  recurrence_frequency?: "weekly" | "monthly" | null;
  recurrence_index?: number | null;
  recurrence_count?: number | null;
  event_professionals?: string[];
  event_attendees?: { id: string; name: string; email: string | null; whatsapp: string | null }[];
  event_description?: string | null;
  event_care_type?: string | null;
  event_capacity?: number | null;
};
type Presenca = { id: string; professional_email: string; date: string; start_at: string; end_at: string; observacao: string | null };

function todaySP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function safeDateStr(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? "")) return todaySP();
  const t = new Date(`${d}T12:00:00-03:00`).getTime();
  return Number.isNaN(t) ? todaySP() : d;
}
function fmtDateBR(d: string): string {
  const [y, m, day] = safeDateStr(d).split("-");
  return `${day}/${m}/${y}`;
}
function toISO(date: string, time: string): string {
  return new Date(`${safeDateStr(date)}T${time}:00-03:00`).toISOString();
}
function fmtTime(d: string): string {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return "--:--";
  return t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
function fmtTimeOnly(t: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(t ?? "");
  return m ? `${m[1]}:${m[2]}` : (t ?? "").slice(0, 5);
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
// Sem sala: externo é no local do cliente, o resto é online.
function placeLabel(a: Appointment): string {
  if (a.room_id) return getRoom(a.room_id)?.nome ?? a.room_id;
  return a.modality === "externo" ? EXTERNO_ROOM_LABEL : ONLINE_ROOM_LABEL;
}
function placeColor(a: Appointment): string {
  if (a.room_id) return getRoom(a.room_id)?.cor ?? "#94a3b8";
  return a.modality === "externo" ? "#a855f7" : "#0ea5e9";
}
function profName(email: string, session: Session, professionals?: { email: string; name: string | null }[]): string {
  if (professionals) {
    const found = professionals.find((p) => p.email.toLowerCase() === email.toLowerCase());
    if (found?.name) return found.name;
  }
  if (email === "claudirisrael@gmail.com") return "Claudir";
  if (email === "clecimarchioro@gmail.com") return "Cleci";
  if (email === "mmgorete00@gmail.com") return "Gorete";
  if (email === "espacorenovaser@gmail.com") return "RenovaSer";
  return email.split("@")[0] ?? email;
}

const MEETING_TEMPLATES = [
  { id: "equipe", label: "Reunião de equipe", title: "Reunião de equipe", objective: "Alinhar prioridades e decisões da equipe", agenda: "1. Atualizações\n2. Pontos de atenção\n3. Decisões e próximos passos" },
  { id: "supervisao", label: "Supervisão", title: "Supervisão", objective: "Discutir o acompanhamento e os próximos passos", agenda: "1. Contexto\n2. Discussão\n3. Encaminhamentos" },
  { id: "planejamento", label: "Planejamento", title: "Planejamento", objective: "Definir ações, responsáveis e prazos", agenda: "1. Objetivo\n2. Opções\n3. Plano de ação" },
];

type MeetingActionItem = { id: string; text: string; owner_email: string | null; due_date: string | null; done: boolean };
type EventAttendee = { id: string; name: string; email: string; whatsapp: string };

export default function AgendaClient({ initialView, initialDate, session }: { initialView: string; initialDate: string; session: Session }) {
  const [view, setView] = useState(initialView);
  const [date, setDate] = useState(safeDateStr(initialDate));
  const [items, setItems] = useState<Appointment[]>([]);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [filterRoom, setFilterRoom] = useState<string | null>(null);
  const [showPresenca, setShowPresenca] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [professionalFilter, setProfessionalFilter] = useState("");

  const [fTitle, setFTitle] = useState("");
  const [fDate, setFDate] = useState(safeDateStr(initialDate));
  const [fCliente, setFCliente] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fClientEmail, setFClientEmail] = useState("");
  const [fModality, setFModality] = useState<"presencial" | "online" | "externo">("presencial");
  const [fPhoneError, setFPhoneError] = useState("");
  const [fEmailError, setFEmailError] = useState("");
  const isExternal = fModality === "externo";
  const contactLabel = isExternal ? "Responsável pelo Evento" : "Cliente";
  const contactBlockTitle = isExternal ? "Responsável pelo evento" : "Dados do cliente";
  const contactEmailLabel = isExternal ? "E-mail do responsável" : "E-mail do cliente";
  const [fRoom, setFRoom] = useState("sala_1");
  const [fCategory, setFCategory] = useState("atendimento");
  const [fEventoTipo, setFEventoTipo] = useState("");
  const [fEventCareType, setFEventCareType] = useState("");
  const [fEventProfessionals, setFEventProfessionals] = useState<string[]>([]);
  const [fEventAttendees, setFEventAttendees] = useState<EventAttendee[]>([]);
  const [fEventDescription, setFEventDescription] = useState("");
  const [fEventCapacity, setFEventCapacity] = useState("");
  const [fStart, setFStart] = useState("09:00");
  const [fEnd, setFEnd] = useState("10:00");
  const [fProf, setFProf] = useState(session.email);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [professionals, setProfessionals] = useState<{ email: string; name: string | null; role: string }[]>([]);
  const [fParticipants, setFParticipants] = useState<string[]>([]);
  const [fGuestEmails, setFGuestEmails] = useState("");
  const [fMeetingType, setFMeetingType] = useState("");
  const [fMeetingObjective, setFMeetingObjective] = useState("");
  const [fMeetingAgenda, setFMeetingAgenda] = useState("");
  const [fPrivateNotes, setFPrivateNotes] = useState("");
  const [fMeetingMinutes, setFMeetingMinutes] = useState("");
  const [fActionItems, setFActionItems] = useState<MeetingActionItem[]>([]);
  const [fReminderMinutes, setFReminderMinutes] = useState<number[]>([60, 30]);
  const [fRecurrence, setFRecurrence] = useState<"" | "daily" | "weekly" | "monthly">("");
  const [fRecurrenceCount, setFRecurrenceCount] = useState(4);
  const [fUpdateSeries, setFUpdateSeries] = useState(false);
  const [availabilitySuggestions, setAvailabilitySuggestions] = useState<{ start_at: string; end_at: string; time: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [guestStatuses, setGuestStatuses] = useState<{ id: string; guests: { email: string; name: string | null; response: string }[] } | null>(null);
  const [loadingGuestStatuses, setLoadingGuestStatuses] = useState(false);

  const [pDate, setPDate] = useState(safeDateStr(initialDate));
  const [pStart, setPStart] = useState("08:00");
  const [pEnd, setPEnd] = useState("12:00");
  const [pProf, setPProf] = useState(session.email);
  const [pObs, setPObs] = useState("");

  function dayRange(d: string) {
    const s = safeDateStr(d);
    return {
      start: new Date(`${s}T00:00:00-03:00`).toISOString(),
      end: new Date(`${s}T23:59:59-03:00`).toISOString(),
    };
  }
  function weekRange(d: string) {
    const dt = new Date(`${safeDateStr(d)}T12:00:00-03:00`);
    const mon = new Date(dt); mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return {
      from: new Date(`${mon.toISOString().slice(0,10)}T00:00:00-03:00`).toISOString(),
      to: new Date(`${sun.toISOString().slice(0,10)}T23:59:59-03:00`).toISOString(),
      mon: mon.toISOString().slice(0,10),
    };
  }

  async function load(showSpinner = false) {
    if (showSpinner) setLoading(true);
    let url = "/api/appointments";
    let presUrl = `/api/presencas?date=${date}`;
    if (view === "dia") {
      const r = dayRange(date);
      url += `?from=${encodeURIComponent(r.start)}&to=${encodeURIComponent(r.end)}`;
    } else {
      const r = weekRange(date);
      url += `?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`;
      // semana: busca todas as presenças da semana com intervalo from/to
      presUrl = `/api/presencas?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`;
    }
    const [aRes, pRes] = await Promise.all([fetch(url), fetch(presUrl)]);
    const data = await aRes.json();
    const pData = await pRes.json();
    setItems(Array.isArray(data) ? data : []);
    // filtra presenças do dia quando em visão dia
    const pList: Presenca[] = Array.isArray(pData) ? pData : [];
    setPresencas(view === "dia" ? pList.filter(p=>p.date===date) : pList);
    setLoading(false);
  }

  const loadForCurrentDate = useEffectEvent(() => { void load(true); });
  useEffect(() => {
    const timer = window.setTimeout(() => loadForCurrentDate(), 0);
    return () => window.clearTimeout(timer);
  }, [date, view]);

  useEffect(() => {
    fetch("/api/professionals")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (Array.isArray(d)) setProfessionals(d); })
      .catch(() => {});
  }, []);

  function openNew(slot?: { date: string; time: string; room?: string }) {
    setEditing(null);
    setFTitle(""); setFCliente(""); setFPhone(""); setFPhoneError(""); setFClientEmail(""); setFEmailError(""); setFCategory("atendimento"); setFEventoTipo("");
    setFEventCareType(""); setFEventProfessionals([]); setFEventAttendees([]); setFEventDescription(""); setFEventCapacity("");
    setFParticipants([]); setFGuestEmails(""); setFMeetingType(""); setFMeetingObjective(""); setFMeetingAgenda("");
    setFPrivateNotes(""); setFMeetingMinutes(""); setFActionItems([]); setFReminderMinutes([60, 30]);
    setFRecurrence(""); setFRecurrenceCount(4); setFUpdateSeries(false); setAvailabilitySuggestions([]); setGuestStatuses(null);
    setFModality("presencial"); setFRoom(slot?.room ?? "sala_1");
    setFStart(slot?.time ?? "09:00");
    const h = parseInt((slot?.time ?? "09:00").split(":")[0] ?? "9", 10);
    setFEnd(String(h + 1).padStart(2,"0")+":00");
    const d = safeDateStr(slot?.date ?? date);
    setDate(d);
    setFDate(d);
    setFProf(session.email);
    setFormError("");
    setShowModal(true);
  }
  function openEdit(a: Appointment) {
    setEditing(a);
    setFTitle(a.title); setFCliente(a.patient_name ?? ""); setFPhone((a.patient_whatsapp ?? "").replace(/\D/g, "").slice(0, 13)); setFPhoneError("");
    setFClientEmail((a.client_email ?? a.patient_email ?? "").slice(0, 120)); setFEmailError("");
    setFCategory(a.category); setFEventoTipo(a.evento_tipo ?? ""); setFModality(a.modality); setFRoom(a.room_id ?? "sala_1");
    setFEventCareType(a.event_care_type ?? ""); setFEventProfessionals(a.event_professionals ?? []);
    setFEventAttendees((a.event_attendees ?? []).map((attendee) => ({ ...attendee, email: attendee.email ?? "", whatsapp: attendee.whatsapp ?? "" })));
    setFEventDescription(a.event_description ?? ""); setFEventCapacity(a.event_capacity ? String(a.event_capacity) : "");
    setFStart(fmtTime(a.start_at)); setFEnd(fmtTime(a.end_at));
    const d = safeDateStr(new Date(a.start_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
    setFDate(d);
    setFProf(a.professional_email ?? a.therapist_email ?? session.email);
    setFParticipants(a.participants ?? []); setFGuestEmails((a.guest_emails ?? []).join(", "));
    setFMeetingType(a.meeting_type ?? ""); setFMeetingObjective(a.meeting_objective ?? ""); setFMeetingAgenda(a.meeting_agenda ?? "");
    setFPrivateNotes(a.private_notes ?? ""); setFMeetingMinutes(a.meeting_minutes ?? ""); setFActionItems(a.action_items ?? []);
    setFReminderMinutes(a.reminder_minutes ?? [60, 30]); setFRecurrence(""); setFRecurrenceCount(4); setFUpdateSeries(false);
    setAvailabilitySuggestions([]); setGuestStatuses(null);
    setFormError("");
    setShowModal(true);
  }

  function handlePhoneChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 13);
    setFPhone(digits);
    if (!digits) { setFPhoneError(""); return; }
    setFPhoneError(isValidPhone(digits) ? "" : "Use só números com DDD (10 a 13 dígitos, ex: 47999998888).");
  }
  function handleEmailChange(v: string) {
    const clean = v.slice(0, 120);
    setFClientEmail(clean);
    const t = clean.trim();
    if (!t) { setFEmailError(""); return; }
    setFEmailError(isValidEmail(t) ? "" : "Confira o e-mail (ex: nome@email.com).");
  }

  function applyMeetingTemplate(templateId: string) {
    const template = MEETING_TEMPLATES.find((item) => item.id === templateId);
    setFMeetingType(templateId);
    if (!template) return;
    setFTitle(template.title);
    setFMeetingObjective(template.objective);
    setFMeetingAgenda(template.agenda);
    setFEnd((start) => {
      const [hour, minute] = start.split(":").map(Number);
      const total = (hour * 60 + minute + 60) % (24 * 60);
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    });
  }

  function addActionItem() {
    setFActionItems((items) => [...items, { id: `${Date.now()}-${Math.random()}`, text: "", owner_email: null, due_date: null, done: false }]);
  }

  function addEventAttendee() {
    setFEventAttendees((attendees) => [...attendees, { id: `${Date.now()}-${Math.random()}`, name: "", email: "", whatsapp: "" }]);
  }

  async function findAvailableTimes() {
    const [startHour, startMinute] = fStart.split(":").map(Number);
    const [endHour, endMinute] = fEnd.split(":").map(Number);
    const duration = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    if (duration < 15) { setFormError("Defina uma duração de pelo menos 15 minutos."); return; }
    setLoadingSuggestions(true);
    setFormError("");
    const params = new URLSearchParams({ date: safeDateStr(fDate), duration: String(duration), modality: fModality === "presencial" ? "presencial" : "online", room_id: fRoom });
    [...new Set([...fParticipants, ...fEventProfessionals, fProf])].forEach((email) => params.append("participant", email));
    const response = await fetch(`/api/meetings/availability?${params}`);
    const data = await response.json();
    setLoadingSuggestions(false);
    if (!response.ok) { setFormError(data.error ?? "Não foi possível buscar horários."); return; }
    setAvailabilitySuggestions(data.suggestions ?? []);
  }

  async function loadGuestStatuses(appointmentId: string) {
    setLoadingGuestStatuses(true);
    const response = await fetch(`/api/appointments/${appointmentId}`);
    const data = await response.json();
    setLoadingGuestStatuses(false);
    if (!response.ok) { alert(data.error ?? "Não foi possível consultar os convites."); return; }
    setGuestStatuses({ id: appointmentId, guests: data.guests ?? [] });
  }

  async function submit() {
    setFormError("");
    if (!fTitle.trim()) { setFormError("Informe o título"); return; }
    if (fCategory === "evento" && !fEventoTipo) { setFormError("Escolha o tipo do evento (Curso, Treinamento, Formação, Workshop ou Atendimento em grupo)."); return; }
    if (fCategory === "evento" && fEventoTipo === "atendimento_grupo" && !fEventCareType) { setFormError("Escolha o tipo de cuidado do atendimento em grupo."); return; }
    const dateStr = safeDateStr(fDate);
    const emailTrim = fClientEmail.trim();
    if (emailTrim && !isValidEmail(emailTrim)) { setFormError("Confira o e-mail: parece incompleto (ex: nome@email.com)."); setFEmailError("Confira o e-mail (ex: nome@email.com)."); return; }
    const phoneTrim = fPhone.trim();
    if (phoneTrim && !isValidPhone(phoneTrim)) { setFormError("Confira o WhatsApp: use só números com DDD (ex: 47999998888)."); setFPhoneError("Use só números com DDD (10 a 13 dígitos, ex: 47999998888)."); return; }
    const start_at = toISO(dateStr, fStart);
    const end_at = toISO(dateStr, fEnd);
    if (new Date(end_at) <= new Date(start_at)) { setFormError("Horário final deve ser após o inicial"); return; }
    const guestEmails = fCategory === "reuniao"
      ? [...new Set(fGuestEmails.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))]
      : [];
    if (guestEmails.some((email) => !isValidEmail(email))) { setFormError("Confira os e-mails dos convidados externos."); return; }
    const isEvent = fCategory === "evento";
    const eventAttendees = isEvent ? fEventAttendees.filter((attendee) => attendee.name.trim()) : [];
    if (isEvent && eventAttendees.length !== fEventAttendees.length) { setFormError("Informe o nome de cada inscrito ou remova a linha vazia."); return; }
    if (isEvent && eventAttendees.some((attendee) => attendee.email && !isValidEmail(attendee.email))) { setFormError("Confira os e-mails dos inscritos."); return; }
    if (isEvent && eventAttendees.some((attendee) => attendee.whatsapp && !isValidPhone(attendee.whatsapp))) { setFormError("Confira o WhatsApp de cada inscrito."); return; }
    if (isEvent && fEventCapacity && (Number(fEventCapacity) < eventAttendees.length || Number(fEventCapacity) < 1)) { setFormError("A capacidade deve ser maior ou igual ao número de inscritos cadastrados."); return; }
    const maxOccurrences = isEvent ? 30 : 12;
    if (fRecurrence && !editing && (fRecurrenceCount < 2 || fRecurrenceCount > maxOccurrences)) { setFormError(`A série deve ter entre 2 e ${maxOccurrences} ocorrências.`); return; }
    setSaving(true);
    const participants = fCategory === "reuniao" ? fParticipants : [];
    const payload = {
      title: fTitle.trim(),
      patient_name: fCategory === "reuniao" || isEvent ? null : (fCliente.trim() || null),
      patient_whatsapp: fCategory === "reuniao" || isEvent ? null : (fPhone.replace(/\D/g,"") || null),
      client_email: fCategory === "reuniao" || isEvent ? null : (fClientEmail.trim() || null),
      room_id: fModality === "presencial" ? fRoom : null,
      modality: fModality,
      category: fCategory,
      evento_tipo: fCategory === "evento" ? fEventoTipo : null,
      professional_email: fProf,
      start_at, end_at,
      participants,
      guest_emails: guestEmails,
      meeting_type: fCategory === "reuniao" ? fMeetingType : null,
      meeting_objective: fCategory === "reuniao" ? fMeetingObjective : null,
      meeting_agenda: fCategory === "reuniao" ? fMeetingAgenda : null,
      private_notes: fCategory === "reuniao" ? fPrivateNotes : null,
      meeting_minutes: fCategory === "reuniao" ? fMeetingMinutes : null,
      action_items: fCategory === "reuniao" ? fActionItems : [],
      reminder_minutes: fCategory === "reuniao" ? fReminderMinutes : [60, 30],
      recurrence_frequency: (fCategory === "reuniao" || isEvent) ? fRecurrence || null : null,
      recurrence_count: (fCategory === "reuniao" || isEvent) && fRecurrence ? fRecurrenceCount : null,
      update_series: fUpdateSeries,
      event_care_type: isEvent ? fEventCareType : null,
      event_professionals: isEvent ? fEventProfessionals : [],
      event_attendees: eventAttendees.map((attendee) => ({
        ...attendee,
        email: attendee.email.trim() || null,
        whatsapp: attendee.whatsapp.replace(/\D/g, "") || null,
      })),
      event_description: isEvent ? fEventDescription : null,
      event_capacity: isEvent && fEventCapacity ? Number(fEventCapacity) : null,
    };
    const url = editing ? `/api/appointments/${editing.id}` : "/api/appointments";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload)});
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setSaving(false); setFormError(data.error ?? "Erro ao salvar"); return; }
    if (data.calendar_warning) alert(data.calendar_warning);
    setShowModal(false);
    setDate(dateStr);
    setFDate(dateStr);
    load(true);
  }

  async function submitPresenca() {
    const res = await fetch("/api/presencas", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ date: safeDateStr(pDate), start_at: pStart, end_at: pEnd, professional_email: pProf, observacao: pObs || null }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error ?? "Erro ao salvar expediente"); return; }
    setShowPresenca(false);
    load(true);
  }

  function canManage(a: Appointment): boolean {
    if (session.isAdmin) return true;
    const o = (a.professional_email ?? a.therapist_email ?? "").trim().toLowerCase();
    return !!o && o === session.email.trim().toLowerCase();
  }
  function canManagePresenca(p: Presenca): boolean {
    if (session.isAdmin) return true;
    return !!p.professional_email && p.professional_email.trim().toLowerCase() === session.email.trim().toLowerCase();
  }

  async function del(id: string, allInSeries = false) {
    const message = allInSeries ? "Excluir todas as ocorrências desta série e cancelar os convites?" : "Excluir este agendamento e cancelar os convites?";
    if (!confirm(message)) return;
    const res = await fetch(`/api/appointments/${id}${allInSeries ? "?scope=series" : ""}`, { method:"DELETE" });
    if (!res.ok) {
      const data = await res.json().catch((): { error?: string } => ({}));
      alert(data.error ?? "Sem permissão para excluir este agendamento.");
      return;
    }
    load(true);
  }

  const hours = Array.from({length:14},(_,i)=> String(8+i).padStart(2,"0")+":00");
  function hourFloor(iso: string): string {
    const t = fmtTime(iso).split(":")[0] ?? "08";
    return `${t.padStart(2,"0")}:00`;
  }
  function hoursCovered(a: Appointment): string[] {
    const startH = parseInt(fmtTime(a.start_at).split(":")[0] ?? "8", 10);
    const endH = parseInt(fmtTime(a.end_at).split(":")[0] ?? "8", 10);
    const endM = parseInt(fmtTime(a.end_at).split(":")[1] ?? "0", 10);
    const last = endM > 0 ? endH : endH - 1;
    const out: string[] = [];
    for (let h = startH; h <= last; h++) out.push(String(h).padStart(2,"0")+":00");
    return out;
  }
  // Bloqueio cruzado: sala individual é bloqueada pela mesma sala + auditório;
  // auditório é bloqueado por qualquer presencial (salas 1/2/3 ou ele mesmo).
  function blockingFor(roomId: string) {
    const list = roomId === "auditorio"
      ? items.filter(a=> a.modality==="presencial" && !!a.room_id)
      : items.filter(a=> a.modality==="presencial" && (a.room_id===roomId || a.room_id==="auditorio"));
    return list.sort((x, y) => new Date(x.start_at).getTime() - new Date(y.start_at).getTime());
  }
  const occupancy = ROOMS.map(r=> {
    const list = blockingFor(r.id);
    const last = list.reduce<Appointment | null>((m, a) => (!m || new Date(a.end_at) > new Date(m.end_at) ? a : m), null);
    return { room: r, count: list.length, list, freeFrom: last ? fmtTime(last.end_at) : null };
  });
  const visibleItems = items.filter((appointment) => {
    const owner = (appointment.professional_email ?? appointment.therapist_email ?? "").toLowerCase();
    const query = searchText.trim().toLowerCase();
    const searchable = [
      appointment.title,
      appointment.patient_name ?? "",
      appointment.meeting_objective ?? "",
      appointment.meeting_agenda ?? "",
      appointment.event_description ?? "",
      profName(owner, session, professionals),
      ...(appointment.participants ?? []),
      ...(appointment.guest_emails ?? []),
      ...(appointment.event_professionals ?? []),
      ...(appointment.event_attendees ?? []).flatMap((attendee) => [attendee.name, attendee.email ?? ""]),
    ].join(" ").toLowerCase();
    return (!query || searchable.includes(query)) &&
      (!categoryFilter || appointment.category === categoryFilter) &&
      (!professionalFilter || owner === professionalFilter || (appointment.event_professionals ?? []).some((email) => email.toLowerCase() === professionalFilter)) &&
      (!filterRoom || appointment.room_id === filterRoom);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={date} onChange={e=>setDate(safeDateStr(e.target.value))} className="border rounded-lg px-3 py-2 text-sm" />
        <button onClick={()=>setDate(todaySP())} className="text-sm border px-3 py-2 rounded-lg">Hoje</button>
        <div className="flex rounded-lg overflow-hidden border text-sm">
          <button onClick={()=>setView("dia")} className={`px-4 py-2 ${view==="dia"?"bg-gray-900 text-white":"bg-white"}`}>Dia</button>
          <button onClick={()=>setView("semana")} className={`px-4 py-2 ${view==="semana"?"bg-gray-900 text-white":"bg-white"}`}>Semana</button>
        </div>
        <button onClick={()=>setShowPresenca(true)} className="text-sm border px-3 py-2 rounded-lg bg-white">+ Expediente</button>
        <button onClick={()=>openNew()} className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg">+ Novo agendamento</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(12rem,1fr)_auto_auto] gap-2">
        <input type="search" value={searchText} onChange={(e) => setSearchText(e.target.value)} aria-label="Buscar agendamentos" placeholder="Buscar título, pauta ou participante" className="border rounded-lg px-3 py-2 text-sm" />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filtrar categoria" className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todas as categorias</option>
          <option value="atendimento">Atendimentos</option>
          <option value="reuniao">Reuniões</option>
          <option value="evento">Eventos</option>
        </select>
        <select value={professionalFilter} onChange={(e) => setProfessionalFilter(e.target.value)} aria-label="Filtrar profissional" className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos os profissionais</option>
          {professionals.map((person) => <option key={person.email} value={person.email.toLowerCase()}>{person.name ?? person.email}</option>)}
        </select>
      </div>

      {/* Quem está presencial hoje */}
      {presencas.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Quem está no instituto — {new Date(`${safeDateStr(date)}T12:00:00-03:00`).toLocaleDateString("pt-BR")}</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {presencas.map(p=> (
              <span key={p.id} className="inline-flex items-center gap-2 text-sm border border-emerald-200 rounded-full px-3 py-1 bg-emerald-100/60 text-emerald-900">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                {profName(p.professional_email, session, professionals)} {fmtTimeOnly(p.start_at)}–{fmtTimeOnly(p.end_at)}
                {p.observacao && <span className="text-xs text-emerald-700">· {p.observacao}</span>}
                {canManagePresenca(p) && (
                  <button onClick={async()=>{ if(confirm("Remover expediente?")){ const res = await fetch(`/api/presencas?id=${p.id}`,{method:"DELETE"}); if (!res.ok) { const d = await res.json().catch((): { error?: string } => ({})); alert(d.error ?? "Sem permissão para remover este expediente."); return; } load(true); } }} className="ml-1 text-emerald-500 hover:text-red-600">×</button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {ROOMS.map(r=> {
          const occ = occupancy.find(o=>o.room.id===r.id)!;
          const isActive = filterRoom===r.id;
          return (
            <button key={r.id} onClick={()=>setFilterRoom(isActive?null:r.id)} className={`text-left border rounded-xl p-3 ${isActive?"ring-2 ring-gray-900":""}`} style={{borderColor: r.cor}} title={isActive ? "Limpar filtro" : "Filtrar por esta sala"}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{background:r.cor}} />
                <span className="text-sm font-medium">{r.nome}</span>
              </div>
              {(() => {
                const own = occ.list.filter(a=> a.room_id===r.id);
                if (r.id!=="auditorio") {
                  // Salas 1/2/3: só os próprios agendamentos, sem "livre a partir"
                  // (o livre a partir mente quando há buracos entre horários)
                  if (own.length===0) {
                    return occ.count>0
                      ? <div className="text-xs font-medium text-amber-700 mt-1">Ocupado (Auditório reservado)</div>
                      : <div className="text-xs text-gray-500 mt-1">Livre hoje</div>;
                  }
                  return (
                    <div className="mt-1 space-y-0.5">
                      {own.slice(0,3).map(a=> (
                        <div key={a.id} className="text-xs text-gray-700 truncate" title={a.title}>
                          {fmtTime(a.start_at)}–{fmtTime(a.end_at)} · {canManage(a) ? profName(a.professional_email ?? a.therapist_email ?? "", session, professionals) : "Reservado"}
                        </div>
                      ))}
                      {own.length>3 && <div className="text-[11px] text-gray-400">+{own.length-3} agendamento(s)</div>}
                    </div>
                  );
                }
                // Auditório: detalhe só do que é dele; bloqueio vindo de sala mostra só o livre a partir
                if (own.length===0) {
                  if (occ.count===0) return <div className="text-xs text-gray-500 mt-1">Livre hoje</div>;
                  return <div className="text-xs font-medium text-amber-700 mt-1">Ocupado — livre a partir das {occ.freeFrom}</div>;
                }
                return (
                  <div className="mt-1 space-y-0.5">
                    {own.slice(0,3).map(a=> (
                      <div key={a.id} className="text-xs text-gray-700 truncate" title={a.title}>
                        {fmtTime(a.start_at)}–{fmtTime(a.end_at)} · {canManage(a) ? profName(a.professional_email ?? a.therapist_email ?? "", session, professionals) : "Reservado"}
                      </div>
                    ))}
                    {own.length>3 && <div className="text-[11px] text-gray-400">+{own.length-3} agendamento(s)</div>}
                    {occ.freeFrom && <div className="text-[11px] font-medium text-emerald-700">Livre a partir das {occ.freeFrom}</div>}
                  </div>
                );
              })()}
            </button>
          );
        })}
      </div>

      {loading ? <div className="text-sm text-gray-500">Carregando…</div> : null}

      {view==="dia" && (
        <div className="bg-white border rounded-xl overflow-hidden">
          {hours.map(h=> {
            const startingHere = visibleItems.filter(a=> hourFloor(a.start_at) === h);
            const continuingHere = visibleItems.filter(a=> {
              const covered = hoursCovered(a);
              return covered.includes(h) && hourFloor(a.start_at) !== h;
            });
            const allHere = [...startingHere, ...continuingHere];
            return (
              <div key={h} className="flex border-b last:border-0 min-h-[56px]">
                <div className="w-20 shrink-0 border-r bg-gray-50 text-xs text-gray-500 flex items-start justify-center pt-2">{h}</div>
                <div className="flex-1 p-2 flex flex-wrap gap-2 items-center">
                  {startingHere.map(a=> {
                    const room = placeLabel(a);
                    const time = fmtTime(a.start_at) + "–" + fmtTime(a.end_at);
                    const roomColor = placeColor(a);
                    return (
                      <div key={a.id} className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[220px] shadow-sm" style={{borderLeft: `4px solid ${roomColor}`}}>
                        <div className="font-medium">{a.title}</div>
                        {eventoLabel(a.evento_tipo) && <div className="text-xs font-semibold text-amber-700">{eventoLabel(a.evento_tipo)}</div>}
                        {a.category === "evento" && a.event_care_type && <div className="text-xs font-semibold text-amber-800">{EVENTO_CUIDADOS.find((care) => care.id === a.event_care_type)?.label ?? a.event_care_type}</div>}
                        <div className="text-xs text-gray-500">{time} · {room}</div>
                        {a.patient_name && <div className="text-xs text-gray-700">{a.patient_name}</div>}
                        {a.category === "evento" && a.event_professionals?.length ? <div className="text-xs text-gray-700">Facilitadores: {a.event_professionals.map((email) => profName(email, session, professionals)).join(", ")}</div> : null}
                        {a.category === "evento" && a.event_attendees && <div className="text-xs text-gray-600">{a.event_attendees.length} inscrito(s){a.event_capacity ? ` · limite ${a.event_capacity}` : ""}</div>}
                        {a.category === "evento" && a.event_description && <div className="text-xs text-gray-600 whitespace-pre-line line-clamp-2">{a.event_description}</div>}
                        {a.category === "evento" && a.event_attendees?.length ? (
                          <details className="mt-1 text-xs"><summary className="cursor-pointer text-amber-800">Lista de inscritos</summary>
                            {a.event_attendees.map((attendee) => <div key={attendee.id} className="mt-1">{attendee.name}</div>)}
                          </details>
                        ) : null}
                        {a.category === "reuniao" && a.meeting_objective && <div className="text-xs text-indigo-700">Objetivo: {a.meeting_objective}</div>}
                        {a.category === "reuniao" && a.meeting_agenda && <div className="text-xs text-gray-600 whitespace-pre-line line-clamp-2">{a.meeting_agenda}</div>}
                        {a.recurrence_count && a.recurrence_index && <div className="text-[11px] text-indigo-700">Série · ocorrência {a.recurrence_index}/{a.recurrence_count}</div>}
                        {a.category === "reuniao" && (a.meeting_minutes || a.action_items?.length) && (
                          <details className="mt-1 text-xs">
                            <summary className="cursor-pointer text-indigo-700">Ata e encaminhamentos</summary>
                            {a.meeting_minutes && <p className="mt-1 whitespace-pre-line text-gray-700">{a.meeting_minutes}</p>}
                            {a.action_items?.map((item) => <div key={item.id} className="mt-1 flex gap-2"><span>{item.done ? "✓" : "○"}</span><span className={item.done ? "line-through text-gray-400" : ""}>{item.text}</span>{item.due_date && <span className="text-gray-500">· {fmtDateBR(item.due_date)}</span>}{item.owner_email && <span className="ml-auto text-gray-500">{profName(item.owner_email, session, professionals)}</span>}</div>)}
                          </details>
                        )}
                        <div className="text-[11px] text-gray-400">{profName(a.professional_email ?? a.therapist_email ?? "", session, professionals)}</div>
                        {a.meeting_link && <a href={a.meeting_link} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">Entrar no Google Meet</a>}
                        <div className="flex gap-2 mt-2">
                          {canManage(a) && <button onClick={()=>openEdit(a)} className="text-xs border px-2 py-1 rounded hover:bg-gray-50">Editar</button>}
                          {canManage(a) && <button onClick={()=>del(a.id)} className="text-xs border px-2 py-1 rounded text-red-600 hover:bg-red-50">Excluir</button>}
                          {(a.category === "reuniao" || a.category === "evento") && a.google_event_id && (session.isAdmin || canManage(a) || (a.participants ?? []).some((email) => email.toLowerCase() === session.email.toLowerCase()) || (a.event_professionals ?? []).some((email) => email.toLowerCase() === session.email.toLowerCase())) && (
                            <button onClick={() => loadGuestStatuses(a.id)} className="text-xs border px-2 py-1 rounded">{loadingGuestStatuses ? "Consultando…" : "Convites / RSVP"}</button>
                          )}
                          {a.patient_whatsapp && !Number.isNaN(new Date(a.start_at).getTime()) && (
                            <a href={formatWhatsAppLink({phone:a.patient_whatsapp, title:a.title, when:new Date(a.start_at), roomLabel: room})} target="_blank" className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">WhatsApp</a>
                          )}
                        </div>
                        {guestStatuses?.id === a.id && (
                          <div className="mt-2 border-t pt-2 space-y-1">
                            {guestStatuses.guests.length === 0 ? <div className="text-xs text-gray-500">Nenhum convidado retornado pelo Google.</div> : guestStatuses.guests.map((guest) => (
                              <div key={guest.email} className="text-xs flex justify-between gap-2"><span className="truncate">{guest.name ?? guest.email}</span><span>{({ accepted: "Aceitou", declined: "Recusou", tentative: "Talvez", needsAction: "Pendente" } as Record<string, string>)[guest.response] ?? guest.response}</span></div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {continuingHere.map(a=> {
                    const roomColor = placeColor(a);
                    return (
                      <div key={`cont-${a.id}-${h}`} className="text-xs px-3 py-1 rounded-full border flex items-center gap-2 opacity-60" style={{borderColor: roomColor, background: `${roomColor}18`}}>
                        <span className="w-2 h-2 rounded-full" style={{background: roomColor}} />
                        {a.title} · continua ({fmtTime(a.start_at)}–{fmtTime(a.end_at)})
                      </div>
                    );
                  })}
                  {allHere.length===0 && (
                    <button onClick={()=>openNew({date,time:h, room: filterRoom ?? undefined})} className="text-xs text-gray-400 hover:text-gray-600">+ agendar às {h}</button>
                  )}
                  {allHere.length>0 && (
                    <button onClick={()=>openNew({date,time:h, room: filterRoom ?? undefined})} className="text-xs text-gray-300 hover:text-gray-500 ml-1">+</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view==="semana" && (
        <div className="bg-white border rounded-xl p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Visão geral do instituto — 7 dias</span>
            <span className="text-xs text-gray-500">Agendamentos de outros profissionais aparecem como “Reservado”, sem dados do cliente.</span>
          </div>
          {(() => {
            const wr = weekRange(date);
            const days = Array.from({length:7},(_,i)=>{ const d=new Date(wr.mon+"T12:00:00-03:00"); d.setDate(d.getDate()+i); return d.toISOString().slice(0,10); });
            return (
              <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                {days.map(d=> {
                  const list = visibleItems.filter(a=> {
                    const t = new Date(a.start_at);
                    return !Number.isNaN(t.getTime()) && t.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})===d;
                  }).sort((x, y) => new Date(x.start_at).getTime() - new Date(y.start_at).getTime());
                  const dayPresencas = presencas.filter(p => p.date === d);
                  const label = new Date(`${safeDateStr(d)}T12:00:00-03:00`).toLocaleDateString("pt-BR",{weekday:"short", day:"2-digit", month:"2-digit"});
                  const isSelected = d===date;
                  return (
                    <div key={d} className={`border rounded-lg p-2 flex flex-col justify-between ${isSelected?"ring-2 ring-emerald-500":""}`}>
                      <div>
                        <button onClick={()=>{ setDate(d); setView("dia"); }} className="text-xs font-semibold capitalize hover:underline" title="Abrir este dia">{label}</button>

                        {/* Quem está no instituto neste dia */}
                        {dayPresencas.length > 0 && (
                          <div className="mt-1.5 mb-2 bg-emerald-50 border border-emerald-200 rounded p-1.5 space-y-1">
                            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Instituto:</div>
                            {dayPresencas.map(p => (
                              <div key={p.id} className="text-[11px] text-emerald-900 bg-emerald-100/70 rounded px-1.5 py-0.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                                <span className="truncate font-medium">{profName(p.professional_email, session, professionals)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1 mt-2">
                          {list.map(a=> {
                            const mine = canManage(a);
                            const room = placeLabel(a);
                            const roomColor = placeColor(a);
                            return (
                              <div key={a.id} className={`text-[11px] border rounded px-2 py-1 bg-white ${mine ? "" : "opacity-70"}`} style={{borderLeft: `3px solid ${roomColor}`}} title={`${a.title}${eventoLabel(a.evento_tipo) ? ` (${eventoLabel(a.evento_tipo)})` : ""} ${fmtTime(a.start_at)}–${fmtTime(a.end_at)} · ${room}${mine ? "" : " (somente visualização)"}`}>
                                <div className="truncate font-medium">{fmtTime(a.start_at)} {a.title}</div>
                                <div className="truncate text-gray-500">{mine ? profName(a.professional_email ?? a.therapist_email ?? "", session, professionals) : "Reservado"}</div>
                                {a.category === "reuniao" && a.meeting_agenda && <div className="truncate text-indigo-700">Pauta: {a.meeting_agenda}</div>}
                                {a.category === "evento" && a.event_care_type && <div className="truncate text-amber-700">{EVENTO_CUIDADOS.find((care) => care.id === a.event_care_type)?.label ?? a.event_care_type}</div>}
                                {a.category === "evento" && a.event_capacity && <div className="text-gray-500">Limite: {a.event_capacity}</div>}
                                {a.meeting_link && <a href={a.meeting_link} target="_blank" rel="noreferrer" className="block truncate text-blue-700 underline">Abrir Meet</a>}
                              </div>
                            );
                          })}
                          {list.length===0 && dayPresencas.length===0 && <div className="text-[11px] text-gray-400">Livre</div>}
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t">
                        <button onClick={()=> openNew({date:d, time:"09:00"})} className="text-[11px] text-emerald-600 hover:text-emerald-700 block w-full text-center">+ agendar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-4 sm:p-6 space-y-4 my-4 sm:my-0 max-h-[92vh] overflow-auto">
            <h2 className="font-semibold text-base sm:text-lg">{editing? "Editar agendamento":"Novo agendamento"} — {fmtDateBR(fDate)}</h2>
            {formError && <div className="sticky top-0 z-10 text-sm font-medium text-red-800 bg-red-100 border-2 border-red-400 rounded-xl px-4 py-3 shadow-sm">⚠️ {formError}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm font-semibold">Data do agendamento*
                <input type="date" value={fDate} onChange={e=>setFDate(safeDateStr(e.target.value))} className="mt-1 w-full border-2 border-emerald-500 bg-emerald-50/30 rounded-lg px-3 py-2 font-medium" />
              </label>
              <label className="block text-sm">Categoria
                <select value={fCategory} onChange={e=>setFCategory(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2">
                  <option value="atendimento">Atendimento</option>
                  <option value="reuniao">Reunião</option>
                  <option value="evento">Evento</option>
                </select>
              </label>
            </div>
            <label className="block text-sm">Título*<input value={fTitle} onChange={e=>setFTitle(e.target.value)} maxLength={120} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Ex: Reunião Equipe, Atendimento Maria" /></label>
            {fCategory === "reuniao" ? (
              <div className="border-2 border-indigo-200 rounded-xl p-4 bg-indigo-50/50 space-y-3">
                <div className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">Participantes da Reunião (Equipe / Terapeutas)</div>
                <p className="text-xs text-indigo-700">Selecione os participantes internos que farão parte desta reunião:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {professionals.map(p => {
                    const isChecked = fParticipants.includes(p.email);
                    return (
                      <label key={p.email} className="flex items-center gap-2 text-sm bg-white p-2 rounded-lg border border-indigo-100 hover:bg-indigo-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setFParticipants([...fParticipants, p.email]);
                            } else {
                              setFParticipants(fParticipants.filter(email => email !== p.email));
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-medium text-gray-800">{p.name ?? p.email}</span>
                        <span className="text-xs text-gray-500 ml-auto">{p.role}</span>
                      </label>
                    );
                  })}
                  {professionals.length === 0 && (
                    <div className="text-xs text-gray-500">Nenhum profissional cadastrado encontrado.</div>
                  )}
                </div>
                <label className="block text-sm font-medium">Modelo de reunião
                  <select value={fMeetingType} onChange={(e) => applyMeetingTemplate(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white">
                    <option value="">Sem modelo</option>
                    {MEETING_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium">Convidados externos (e-mails separados por vírgula)
                  <textarea value={fGuestEmails} onChange={(e) => setFGuestEmails(e.target.value)} rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" placeholder="pessoa@exemplo.com, equipe@parceiro.org" />
                </label>
                <label className="block text-sm font-medium">Objetivo
                  <textarea value={fMeetingObjective} onChange={(e) => setFMeetingObjective(e.target.value)} maxLength={1000} rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" placeholder="O que precisa estar decidido ao final?" />
                </label>
                <label className="block text-sm font-medium">Pauta
                  <textarea value={fMeetingAgenda} onChange={(e) => setFMeetingAgenda(e.target.value)} maxLength={5000} rows={4} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" placeholder="Tópicos da reunião; cada linha pode ser um item." />
                </label>
                <label className="block text-sm font-medium">Notas privadas (só responsáveis e admins)
                  <textarea value={fPrivateNotes} onChange={(e) => setFPrivateNotes(e.target.value)} maxLength={5000} rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" />
                </label>
                <label className="block text-sm font-medium">Ata / resumo (visível aos participantes internos)
                  <textarea value={fMeetingMinutes} onChange={(e) => setFMeetingMinutes(e.target.value)} maxLength={10000} rows={3} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" placeholder="Registre decisões e contexto após a reunião." />
                </label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Encaminhamentos</span>
                    <button type="button" onClick={addActionItem} className="text-xs border rounded-lg px-2 py-1 bg-white">+ Tarefa</button>
                  </div>
                  {fActionItems.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto_auto] gap-2 bg-white border rounded-lg p-2">
                      <input value={item.text} onChange={(e) => setFActionItems((items) => items.map((current, i) => i === index ? { ...current, text: e.target.value } : current))} maxLength={500} aria-label="Tarefa" placeholder="Ação a realizar" className="border rounded px-2 py-1 text-sm" />
                      <select value={item.owner_email ?? ""} onChange={(e) => setFActionItems((items) => items.map((current, i) => i === index ? { ...current, owner_email: e.target.value || null } : current))} aria-label="Responsável pela tarefa" className="border rounded px-2 py-1 text-sm">
                        <option value="">Sem responsável</option>
                        {professionals.map((person) => <option key={person.email} value={person.email}>{person.name ?? person.email}</option>)}
                      </select>
                      <input type="date" value={item.due_date ?? ""} onChange={(e) => setFActionItems((items) => items.map((current, i) => i === index ? { ...current, due_date: e.target.value || null } : current))} aria-label="Prazo" className="border rounded px-2 py-1 text-sm" />
                      <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={item.done} onChange={(e) => setFActionItems((items) => items.map((current, i) => i === index ? { ...current, done: e.target.checked } : current))} />Concluída</label>
                      <button type="button" onClick={() => setFActionItems((items) => items.filter((_, i) => i !== index))} aria-label="Remover tarefa" className="px-2 text-red-600">Remover</button>
                    </div>
                  ))}
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Lembretes do Google Calendar</legend>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {[10, 30, 60, 1440].map((minutes) => (
                      <label key={minutes} className="inline-flex items-center gap-1"><input type="checkbox" checked={fReminderMinutes.includes(minutes)} onChange={(e) => setFReminderMinutes((current) => e.target.checked ? [...current, minutes] : current.filter((value) => value !== minutes))} />{minutes === 1440 ? "1 dia" : `${minutes} min`}</label>
                    ))}
                  </div>
                </fieldset>
                {!editing && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-sm">Repetir
                      <select value={fRecurrence} onChange={(e) => setFRecurrence(e.target.value as "" | "weekly" | "monthly")} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white">
                        <option value="">Não repetir</option><option value="weekly">Semanalmente</option><option value="monthly">Mensalmente</option>
                      </select>
                    </label>
                    {fRecurrence && <label className="block text-sm">Ocorrências (2 a 12)
                      <input type="number" min={2} max={12} value={fRecurrenceCount} onChange={(e) => setFRecurrenceCount(Number(e.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" />
                    </label>}
                  </div>
                )}
                {editing?.series_id && (
                  <label className="inline-flex items-center gap-2 text-xs text-indigo-900">
                    <input type="checkbox" checked={fUpdateSeries} onChange={(e) => setFUpdateSeries(e.target.checked)} />
                    Aplicar alterações a todas as ocorrências da série
                  </label>
                )}
                <div className="space-y-2">
                  <button type="button" onClick={findAvailableTimes} disabled={loadingSuggestions} className="text-sm border rounded-lg px-3 py-2 bg-white disabled:opacity-50">{loadingSuggestions ? "Buscando…" : "Sugerir horários livres"}</button>
                  {availabilitySuggestions.length > 0 && <div className="flex flex-wrap gap-2">{availabilitySuggestions.map((slot) => (
                    <button key={slot.start_at} type="button" onClick={() => {
                      const duration = Number((new Date(toISO(fDate, fEnd)).getTime() - new Date(toISO(fDate, fStart)).getTime()) / 60000);
                      const [hour, minute] = slot.time.split(":").map(Number);
                      const total = hour * 60 + minute + duration;
                      setFStart(slot.time);
                      setFEnd(`${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`);
                      setAvailabilitySuggestions([]);
                    }} className="text-xs border border-emerald-300 bg-white rounded-full px-3 py-1">{slot.time}</button>
                  ))}</div>}
                  {availabilitySuggestions.length === 0 && !loadingSuggestions && <p className="text-xs text-gray-500">As sugestões consideram sala e participantes selecionados, entre 08:00 e 18:00.</p>}
                </div>
                {editing?.google_event_id && (
                  <div className="space-y-2">
                    <button type="button" onClick={() => loadGuestStatuses(editing.id)} className="text-sm border rounded-lg px-3 py-2 bg-white">{loadingGuestStatuses ? "Consultando…" : "Consultar respostas dos convites"}</button>
                    {guestStatuses?.id === editing.id && guestStatuses.guests.map((guest) => (
                      <div key={guest.email} className="flex justify-between gap-2 text-xs"><span>{guest.name ?? guest.email}</span><span>{({ accepted: "Aceitou", declined: "Recusou", tentative: "Talvez", needsAction: "Pendente" } as Record<string, string>)[guest.response] ?? guest.response}</span></div>
                    ))}
                    {editing.meeting_link && <a href={editing.meeting_link} target="_blank" rel="noreferrer" className="block text-sm text-blue-700 underline">Abrir link do Google Meet</a>}
                  </div>
                )}
              </div>
            ) : fCategory === "evento" ? (
              <div className="border-2 border-amber-200 rounded-xl p-4 bg-amber-50/50 space-y-3">
                <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Dados do evento / curso</div>
                <label className="block text-sm font-medium">Tipo do evento*
                  <select value={fEventoTipo} onChange={(e) => { setFEventoTipo(e.target.value); if (e.target.value !== "atendimento_grupo") setFEventCareType(""); }} className="mt-1 w-full border-2 border-amber-300 bg-white rounded-lg px-3 py-2">
                    <option value="">Selecione…</option>
                    {EVENTO_TIPOS.map((eventType) => <option key={eventType.id} value={eventType.id}>{eventType.label}</option>)}
                  </select>
                </label>
                {fEventoTipo === "atendimento_grupo" && (
                  <label className="block text-sm font-medium">Tipo de cuidado*
                    <select value={fEventCareType} onChange={(e) => setFEventCareType(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white">
                      <option value="">Selecione…</option>
                      {EVENTO_CUIDADOS.map((care) => <option key={care.id} value={care.id}>{care.label}</option>)}
                    </select>
                  </label>
                )}
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Profissionais facilitadores</legend>
                  <p className="text-xs text-gray-600">Selecione uma ou várias pessoas da equipe.</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {professionals.map((person) => (
                      <label key={person.email} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
                        <input type="checkbox" checked={fEventProfessionals.includes(person.email)} onChange={(e) => setFEventProfessionals((current) => e.target.checked ? [...new Set([...current, person.email])] : current.filter((email) => email !== person.email))} />
                        <span>{person.name ?? person.email}</span><span className="ml-auto text-xs text-gray-500">{person.role}</span>
                      </label>
                    ))}
                    {professionals.length === 0 && <p className="text-xs text-gray-500">Cadastre profissionais no painel administrativo.</p>}
                  </div>
                </fieldset>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div><div className="text-sm font-medium">Inscritos / participantes</div><div className="text-xs text-gray-600">Nome obrigatório; e-mail recebe o convite e WhatsApp fica interno.</div></div>
                    <button type="button" onClick={addEventAttendee} className="shrink-0 rounded-lg border bg-white px-3 py-2 text-xs">+ Inscrito</button>
                  </div>
                  {fEventAttendees.map((attendee, index) => (
                    <div key={attendee.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_0.8fr_auto] gap-2 rounded-lg border bg-white p-2">
                      <input value={attendee.name} onChange={(e) => setFEventAttendees((current) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} maxLength={120} aria-label={`Nome do inscrito ${index + 1}`} placeholder="Nome completo" className="min-w-0 border rounded px-2 py-2 text-sm" />
                      <input type="email" value={attendee.email} onChange={(e) => setFEventAttendees((current) => current.map((item, i) => i === index ? { ...item, email: e.target.value } : item))} maxLength={120} aria-label={`E-mail do inscrito ${index + 1}`} placeholder="E-mail (opcional)" className="min-w-0 border rounded px-2 py-2 text-sm" />
                      <input inputMode="tel" value={attendee.whatsapp} onChange={(e) => setFEventAttendees((current) => current.map((item, i) => i === index ? { ...item, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 13) } : item))} maxLength={13} aria-label={`WhatsApp do inscrito ${index + 1}`} placeholder="WhatsApp" className="min-w-0 border rounded px-2 py-2 text-sm" />
                      <button type="button" onClick={() => setFEventAttendees((current) => current.filter((_, i) => i !== index))} aria-label={`Remover inscrito ${index + 1}`} className="px-2 text-xs text-red-600">Remover</button>
                    </div>
                  ))}
                  <div className="text-xs text-gray-600">{fEventAttendees.length} inscrito(s) cadastrado(s)</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-sm">Limite de participantes (opcional)
                    <input type="number" min={1} value={fEventCapacity} onChange={(e) => setFEventCapacity(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" placeholder="Ex.: 25" />
                  </label>
                  {!editing && (
                    <label className="block text-sm">Duração do evento
                      <select value={fRecurrence} onChange={(e) => setFRecurrence(e.target.value as "" | "daily" | "weekly" | "monthly")} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white">
                        <option value="">Um dia</option><option value="daily">Dias consecutivos</option><option value="weekly">Mesmo dia, semanal</option><option value="monthly">Mesmo dia, mensal</option>
                      </select>
                    </label>
                  )}
                </div>
                {!editing && fRecurrence && <label className="block text-sm">Quantidade de dias / encontros (2 a 30)
                  <input type="number" min={2} max={30} value={fRecurrenceCount} onChange={(e) => setFRecurrenceCount(Number(e.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" />
                </label>}
                {editing?.series_id && (
                  <label className="inline-flex items-center gap-2 text-xs text-amber-900">
                    <input type="checkbox" checked={fUpdateSeries} onChange={(e) => setFUpdateSeries(e.target.checked)} />
                    Aplicar alterações a todos os dias do curso / evento
                  </label>
                )}
                <label className="block text-sm">Descrição do evento (compartilhada com convidados)
                  <textarea value={fEventDescription} onChange={(e) => setFEventDescription(e.target.value)} maxLength={3000} rows={3} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" placeholder="Descreva objetivo, programação ou orientações do evento." />
                  <span className="text-[11px] text-gray-500">Não inclua dados clínicos ou contatos pessoais aqui. E-mails e WhatsApps dos inscritos não aparecem no convite.</span>
                </label>
              </div>
            ) : (
              <div className="border-2 border-gray-300 rounded-xl p-4 bg-gray-50 space-y-3">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{contactBlockTitle}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-sm">{contactLabel}<input value={fCliente} onChange={e=>setFCliente(e.target.value)} maxLength={120} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder={isExternal ? "Nome do responsável" : "Nome (opcional p/ reuniões)"} /></label>
                  <label className="block text-sm">WhatsApp
                    <input value={fPhone} onChange={e=>handlePhoneChange(e.target.value)} inputMode="numeric" maxLength={13} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="47999998888" />
                    {fPhoneError && <span className="text-[11px] text-red-600">{fPhoneError}</span>}
                  </label>
                </div>
                <label className="block text-sm">{contactEmailLabel}
                  <input type="email" value={fClientEmail} onChange={e=>handleEmailChange(e.target.value)} maxLength={120} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="cliente@email.com — recebe convite + pop-up 60/30min" />
                  {fEmailError && <span className="text-[11px] text-red-600">{fEmailError}</span>}
                </label>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">Início<input type="time" value={fStart} onChange={e=>setFStart(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
              <label className="block text-sm">Fim<input type="time" value={fEnd} onChange={e=>setFEnd(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
            </div>
            <label className="block text-sm">Modalidade
              <select value={fModality} onChange={e=>setFModality(e.target.value as Appointment["modality"])} className="mt-1 w-full border rounded-lg px-3 py-2">
                <option value="presencial">Presencial</option>
                <option value="online">Online (não ocupa sala)</option>
                <option value="externo">Evento externo — local do cliente (não ocupa sala)</option>
              </select>
            </label>
            {fModality==="presencial" && (
              <label className="block text-sm">Sala
                <select value={fRoom} onChange={e=>setFRoom(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2">
                  {ROOMS.map(r=> <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </label>
            )}
            {session.isAdmin && (
              <label className="block text-sm">Profissional
                <select value={fProf} onChange={e=>setFProf(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2">
                  <option value={session.email}>{profName(session.email, session, professionals)} (você)</option>
                  {professionals.filter(p=>p.email.toLowerCase()!==session.email.toLowerCase()).map(p=> (
                    <option key={p.email} value={p.email}>{p.name ?? p.email}</option>
                  ))}
                  {!professionals.some(p=>p.email.toLowerCase()===fProf.toLowerCase()) && fProf.toLowerCase()!==session.email.toLowerCase() && (
                    <option value={fProf}>{fProf}</option>
                  )}
                </select>
                <span className="text-[11px] text-gray-500">Os participantes selecionados recebem convite do Google Calendar. <a href="/admin" className="underline">Cadastrar profissionais</a></span>
              </label>
            )}
            <div className="flex gap-2 justify-end pt-2">
              {editing?.series_id && <button onClick={()=>del(editing.id, true)} className="mr-auto px-3 py-2 border rounded-lg text-sm text-red-600">Excluir série</button>}
              <button onClick={()=>setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={submit} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">{saving?"Salvando…": editing?.series_id && fUpdateSeries?"Salvar série":editing?.series_id?"Salvar ocorrência":editing?"Salvar":"Criar"}</button>
            </div>
          </div>
        </div>
      )}

      {showPresenca && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-semibold">Marcar expediente presencial</h2>
            <p className="text-xs text-gray-500">Só informa quem estará no instituto — não bloqueia sala.</p>
            <label className="block text-sm">Data<input type="date" value={pDate} onChange={e=>setPDate(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">Início<input type="time" value={pStart} onChange={e=>setPStart(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
              <label className="block text-sm">Fim<input type="time" value={pEnd} onChange={e=>setPEnd(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
            </div>
            {session.isAdmin ? (
              <label className="block text-sm">Profissional
                <select value={pProf} onChange={e=>setPProf(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2">
                  <option value={session.email}>{profName(session.email, session, professionals)} (você)</option>
                  {professionals.filter(p=>p.email.toLowerCase()!==session.email.toLowerCase()).map(p=> (
                    <option key={p.email} value={p.email}>{p.name ?? p.email}</option>
                  ))}
                  {!professionals.some(p=>p.email.toLowerCase()===pProf.toLowerCase()) && pProf.toLowerCase()!==session.email.toLowerCase() && (
                    <option value={pProf}>{pProf}</option>
                  )}
                </select>
              </label>
            ) : (
              <div className="text-sm text-gray-600">Expediente de <b>{profName(session.email, session, professionals)}</b></div>
            )}
            <label className="block text-sm">Observação (opcional)<input value={pObs} onChange={e=>setPObs(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Ex: manhã, recepção" /></label>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setShowPresenca(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={submitPresenca} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
