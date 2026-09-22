import type { RoomId, Evento, TherapistUser } from '../types';
import { getRoomById, checkRoomAvailability } from './roomService';

export interface ParsedBookingItem {
  title: string;
  category: 'atendimento' | 'reuniao' | 'evento';
  date: string; // YYYY-MM-DD
  time: string; // HH:MM - HH:MM
  roomId?: RoomId;
  roomName?: string;
  location: string;
  type: 'presencial' | 'online';
  therapistId: string;
}

export interface AssistantParseResult {
  isBooking: boolean;
  items: ParsedBookingItem[];
  feedbackSummary?: string;
  originalText: string;
}

/**
 * Normaliza e extrai data do texto (suporta DD/MM/AAAA, DD/MM, "amanhã", "hoje", etc.)
 */
export function extractDateFromText(text: string): string {
  const lower = text.toLowerCase();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // DD/MM/AAAA ou DD/MM
  const dateMatch = lower.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    let year = today.getFullYear().toString();
    if (dateMatch[3]) {
      year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
    }
    return `${year}-${month}-${day}`;
  }

  // "amanhã"
  if (lower.includes('amanhã') || lower.includes('amanha')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  return todayStr;
}

/**
 * Extrai intervalo de horário do texto:
 * Ex: "das 10h às 16h", "das 10 as 16 horas", "10h às 16h", "10:00 - 16:00", "às 14h"
 */
export function extractTimeRangeFromText(text: string): { timeRange: string; hasExplicitTime: boolean } {
  const lower = text.toLowerCase();

  // Caso 1: Intervalo explícito "das 10h às 16h", "das 10 as 16 horas", "10h a 16h", "10:00 as 16:00"
  const rangeMatch = lower.match(
    /(?:das?|de)?\s*(\d{1,2})(?:[h:](\d{2})?)?\s*(?:às|as|a|-|até)\s*(\d{1,2})(?:[h:](\d{2})?)?\s*(?:h|horas?)?/
  );

  if (rangeMatch && rangeMatch[1] && rangeMatch[3]) {
    const startH = rangeMatch[1].padStart(2, '0');
    const startM = rangeMatch[2] || '00';
    const endH = rangeMatch[3].padStart(2, '0');
    const endM = rangeMatch[4] || '00';
    return {
      timeRange: `${startH}:${startM} - ${endH}:${endM}`,
      hasExplicitTime: true
    };
  }

  // Caso 2: Hora única simples "às 14h", "15:30"
  const singleMatch = lower.match(/(?:às|as|as)?\s*(\d{1,2})(?:[h:](\d{2}))/);
  if (singleMatch && singleMatch[1]) {
    const startH = singleMatch[1].padStart(2, '0');
    const startM = singleMatch[2] || '00';
    const nextH = (parseInt(startH, 10) + 1).toString().padStart(2, '0');
    return {
      timeRange: `${startH}:${startM} - ${nextH}:${startM}`,
      hasExplicitTime: true
    };
  }

  // Default padrão caso não ache hora explícita
  return {
    timeRange: '10:00 - 16:00',
    hasExplicitTime: false
  };
}

/**
 * Analisador mestre de comandos do assistente.
 * Suporta agendamentos individuais E agendamentos múltiplos/simultâneos por sala.
 */
export function parseAssistantCommand(
  text: string,
  events: Evento[],
  therapists: TherapistUser[]
): AssistantParseResult {
  const lower = text.toLowerCase();
  const defaultTherapistId = therapists[0]?.id || 'admin1';

  const isBookingKeyword =
    lower.includes('agendar') ||
    lower.includes('marcar') ||
    lower.includes('reservar') ||
    lower.includes('atendimento') ||
    lower.includes('reunião') ||
    lower.includes('reuniao') ||
    lower.includes('sala 1') ||
    lower.includes('sala 2') ||
    lower.includes('sala 3') ||
    lower.includes('auditório') ||
    lower.includes('auditorio');

  if (!isBookingKeyword) {
    return {
      isBooking: false,
      items: [],
      originalText: text
    };
  }

  const dateVal = extractDateFromText(text);
  const { timeRange } = extractTimeRangeFromText(text);

  // Extrai evento geral/tema se houver (ex: "Sábado do Cuidado")
  let themePrefix = '';
  const themeMatch = text.match(/(?:-\s*)([A-ZÁÉÍÓÚÂÊÔÃÕa-záéíóúâêôãõ\s]+?)(?:,|\.|\s-|\satendimentos|\slocais)/i);
  if (themeMatch && themeMatch[1] && themeMatch[1].trim().length > 3) {
    themePrefix = themeMatch[1].trim();
  } else if (lower.includes('sábado do cuidado') || lower.includes('sabado do cuidado')) {
    themePrefix = 'Sábado do Cuidado';
  }

  // --- DETECÇÃO DE MÚLTIPLAS SALAS (SALA 1, SALA 2, SALA 3, AUDITÓRIO) ---
  const hasSala1 = lower.includes('sala 1') || lower.includes('harmonia');
  const hasSala2 = lower.includes('sala 2') || lower.includes('serenidade');
  const hasSala3 = lower.includes('sala 3') || lower.includes('vitalidade');
  const hasAuditorio = lower.includes('auditório') || lower.includes('auditorio');

  const multipleRoomsCount = [hasSala1, hasSala2, hasSala3, hasAuditorio].filter(Boolean).length;

  if (multipleRoomsCount > 1) {
    // Modo Múltiplas Salas: Extrair o propósito/terapia de cada sala mencionada
    const items: ParsedBookingItem[] = [];

    // Sala 1
    if (hasSala1) {
      let desc = 'Constelação e Quiropraxia';
      const m1 = text.match(/sala\s*1\s*[-–:]?\s*(?:reservar\s*para\s*(?:atendimento\s*de)?)?([^.\n,]+?)(?:a\s*sala\s*2|na\s*sala\s*2|sala\s*2|$)/i);
      if (m1 && m1[1] && m1[1].trim().length > 2) {
        desc = m1[1].replace(/reservar para (?:atendimento de )?/i, '').trim();
      }
      const room = getRoomById('sala_1');
      const title = themePrefix ? `${themePrefix} - ${desc}` : desc;

      items.push({
        title,
        category: 'atendimento',
        date: dateVal,
        time: timeRange,
        roomId: 'sala_1',
        roomName: room?.label || 'Sala 1 • Harmonia',
        location: room?.label || 'Sala 1 • Harmonia',
        type: 'presencial',
        therapistId: defaultTherapistId
      });
    }

    // Sala 2
    if (hasSala2) {
      let desc = 'Reiki e Quick Massagem';
      const m2 = text.match(/sala\s*2\s*[-–:]?\s*(?:reservar\s*para\s*(?:atendimento\s*de)?)?([^.\n,]+?)(?:a\s*sala\s*3|na\s*sala\s*3|sala\s*3|$)/i);
      if (m2 && m2[1] && m2[1].trim().length > 2) {
        desc = m2[1].replace(/reservar para (?:atendimento de )?/i, '').trim();
      }
      const room = getRoomById('sala_2');
      const title = themePrefix ? `${themePrefix} - ${desc}` : desc;

      items.push({
        title,
        category: 'atendimento',
        date: dateVal,
        time: timeRange,
        roomId: 'sala_2',
        roomName: room?.label || 'Sala 2 • Serenidade',
        location: room?.label || 'Sala 2 • Serenidade',
        type: 'presencial',
        therapistId: defaultTherapistId
      });
    }

    // Sala 3
    if (hasSala3) {
      let desc = 'Barra de Access e Tarot';
      const m3 = text.match(/sala\s*3\s*[-–:]?\s*(?:reservar\s*para\s*(?:atendimento\s*de)?)?([^.\n,]+?)(?:reserve|horário|horario|$)/i);
      if (m3 && m3[1] && m3[1].trim().length > 2) {
        desc = m3[1].replace(/reservar para (?:atendimento de )?/i, '').trim();
      }
      const room = getRoomById('sala_3');
      const title = themePrefix ? `${themePrefix} - ${desc}` : desc;

      items.push({
        title,
        category: 'atendimento',
        date: dateVal,
        time: timeRange,
        roomId: 'sala_3',
        roomName: room?.label || 'Sala 3 • Vitalidade',
        location: room?.label || 'Sala 3 • Vitalidade',
        type: 'presencial',
        therapistId: defaultTherapistId
      });
    }

    // Auditório
    if (hasAuditorio) {
      const room = getRoomById('auditorio');
      items.push({
        title: themePrefix ? `${themePrefix} - Evento Geral` : 'Evento no Auditório',
        category: 'evento',
        date: dateVal,
        time: timeRange,
        roomId: 'auditorio',
        roomName: room?.label || 'Auditório • Conexão & Expansão',
        location: room?.label || 'Auditório • Conexão & Expansão',
        type: 'presencial',
        therapistId: defaultTherapistId
      });
    }

    return {
      isBooking: true,
      items,
      originalText: text
    };
  }

  // --- MODO AGENDAMENTO INDIVIDUAL (1 SALA) ---
  const isOnline = lower.includes('online') || lower.includes('meet') || lower.includes('zoom');
  const isReuniao = lower.includes('reuni') || lower.includes('equipe');

  let assignedRoomId: RoomId | undefined = undefined;
  if (!isOnline) {
    if (hasAuditorio) assignedRoomId = 'auditorio';
    else if (hasSala3) assignedRoomId = 'sala_3';
    else if (hasSala2) assignedRoomId = 'sala_2';
    else if (hasSala1) assignedRoomId = 'sala_1';
    else {
      const availability = checkRoomAvailability(dateVal, timeRange, events);
      assignedRoomId = availability.firstAvailableRoomId || 'sala_1';
    }
  }

  const roomObj = assignedRoomId ? getRoomById(assignedRoomId) : undefined;
  const roomLabel = roomObj ? roomObj.label : 'Sala 1 • Harmonia';

  let titleVal = isReuniao
    ? 'Reunião com a Equipe de Terapeutas'
    : 'Atendimento Terapêutico';

  if (themePrefix) {
    titleVal = themePrefix;
  } else if (lower.includes('com dr.') || lower.includes('com dra.')) {
    titleVal = 'Atendimento Clínico';
  } else if (text.includes('-')) {
    const parts = text.split('-');
    const candidate = parts.find((p) => p.trim().length > 3 && !p.toLowerCase().includes('sala'));
    if (candidate) {
      titleVal = candidate.trim();
    }
  }

  return {
    isBooking: true,
    items: [
      {
        title: titleVal,
        category: isReuniao ? 'reuniao' : 'atendimento',
        date: dateVal,
        time: timeRange,
        roomId: assignedRoomId,
        roomName: roomObj ? roomObj.label : undefined,
        location: isOnline ? 'Online - Google Meet' : roomLabel,
        type: isOnline ? 'online' : 'presencial',
        therapistId: defaultTherapistId
      }
    ],
    originalText: text
  };
}
