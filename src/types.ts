export type ScheduleCategory = 'atendimento' | 'reuniao' | 'evento' | 'comunicacao';

export type RoomId = 'sala_1' | 'sala_2' | 'sala_3' | 'auditorio';

export interface Room {
  id: RoomId;
  name: string; // Ex: "Harmonia"
  label: string; // Ex: "Sala 1 - Harmonia"
  code: string; // Ex: "Sala 1"
  purpose: string; // Propósito terapêutico / acolhimento
  capacity: string;
  themeColor: {
    bg: string;
    text: string;
    border: string;
    badge: string;
    dot: string;
  };
  isIntegrated?: boolean; // Auditório abrange as 3 salas
  subRooms?: RoomId[]; // ['sala_1', 'sala_2', 'sala_3']
}

export interface Evento {
  id: string;
  title: string;
  category: 'atendimento' | 'reuniao' | 'evento';
  time: string;
  date: string; // YYYY-MM-DD
  location: string;
  type: 'presencial' | 'online';
  therapistId: string;
  roomId?: RoomId; // Sala 1, Sala 2, Sala 3 ou Auditório
  roomName?: string; // Nome descritivo da sala
  clientEmail?: string;
  clientWhatsApp?: string;
  badgeColor: string;
  createdAt?: string;
  googleEventId?: string;
  googleHtmlLink?: string;
  syncedWithGoogle?: boolean;
}

export interface TherapistUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'terapeuta';
  technique?: string; // ex: Reiki, Tarô, Florais, etc.
  password?: string; // Senha individual de acesso ao sistema
  createdAt?: string;
}

export type EventSubtype = 'workshop' | 'treinamento' | 'formacao' | 'transmissao_online';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'professional';
  specialty?: string; // ex: Psicologia, Fisioterapia, Nutrição...
  createdAt: string;
}

export interface EmailNotice {
  to: string;
  subject: string;
  body: string;
  googleCalendarUrl?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees?: string[];
  meetLink?: string | null;
  htmlLink?: string;
  status?: string;
  description?: string;
  location?: string;
  professionalName?: string;
  professionalEmail?: string;
  isInstitutionalEvent?: boolean;
  category?: ScheduleCategory;
  eventSubtype?: EventSubtype;
}

export interface ChatMessage {
  id: string;
  userId?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  pendingActions?: PendingAction[];
  executedEvents?: CalendarEvent[];
  isError?: boolean;
  retryText?: string;
  authExpired?: boolean;
  emailNotice?: EmailNotice;
}

export interface PendingAction {
  type: 'requestEventCancellation' | 'requestEventUpdate';
  args: {
    eventId: string;
    eventTitle: string;
    startDateTime?: string;
    newTitle?: string;
    newStartDateTime?: string;
    newEndDateTime?: string;
    newAttendees?: string[];
  };
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  timeZone: string;
  defaultMeetingDurationMinutes: number;
  createdAt: string;
}

export interface MeetingAuditLog {
  id: string;
  userId: string;
  eventId?: string;
  title: string;
  startDateTime?: string;
  endDateTime?: string;
  action: 'created' | 'updated' | 'cancelled';
  createdAt: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
  conflictTitle?: string;
}
