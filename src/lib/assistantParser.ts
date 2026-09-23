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
 * Normaliza e extrai data do texto (suporta DD/MM/AAAA, DD/MM, "dia 26", "dia 26 de setembro", "amanhã", "hoje", etc.)
 */
export function extractDateFromText(text: string): string {
  const lower = text.toLowerCase();
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12

  // 1. DD/MM/AAAA ou DD/MM (ex: 26/09 ou 26/09/2026)
  const slashMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    let year = currentYear;
    if (slashMatch[3]) {
      year = slashMatch[3].length === 2 ? parseInt(`20${slashMatch[3]}`, 10) : parseInt(slashMatch[3], 10);
    }
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 2. "dia 26 de setembro", "26 de outubro de 2026"
  const monthNames: Record<string, number> = {
    janeiro: 1, jan: 1,
    fevereiro: 2, fev: 2,
    março: 3, marco: 3, mar: 3,
    abril: 4, abr: 4,
    maio: 5, mai: 5,
    junho: 6, jun: 6,
    julho: 7, jul: 7,
    agosto: 8, ago: 8,
    setembro: 9, set: 9,
    outubro: 10, out: 10,
    novembro: 11, nov: 11,
    dezembro: 12, dez: 12
  };

  const dayDeMonthMatch = lower.match(/(?:dia|data)?\s*(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?/i);
  if (dayDeMonthMatch) {
    const day = parseInt(dayDeMonthMatch[1], 10);
    const mStr = dayDeMonthMatch[2].toLowerCase();
    const month = monthNames[mStr];
    const year = dayDeMonthMatch[3] ? parseInt(dayDeMonthMatch[3], 10) : currentYear;
    if (day >= 1 && day <= 31 && month) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 3. "dia 26" ou "data 26" (sem mês -> assume mês atual)
  const diaMatch = lower.match(/(?:dia|data)\s*(\d{1,2})\b/i);
  if (diaMatch) {
    const day = parseInt(diaMatch[1], 10);
    if (day >= 1 && day <= 31) {
      return `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 4. "amanhã" ou "amanha"
  if (lower.includes('amanhã') || lower.includes('amanha')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  // 5. Default: hoje
  return today.toISOString().split('T')[0];
}

/**
 * Extrai intervalo de horário do texto garantindo que horas estejam estritamente entre 00 e 23,
 * e impedindo que números de datas (ex: dia 26) sejam confundidos com horários.
 */
export function extractTimeRangeFromText(text: string): { timeRange: string; hasExplicitTime: boolean } {
  const lower = text.toLowerCase();

  // Limpa números de datas para que dia 26, 26/09, 2026 NUNCA sejam capturados como horas
  const cleaned = lower
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/(?:dia|data)\s*\d{1,2}(?:\s+de\s+[a-zç]+)?(?:\s+de\s+\d{4})?/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b(202[4-9]|203\d)\b/g, ' ')
    .replace(/\b(amanhã|amanha|hoje|ontem)\b/g, ' ');

  // Caso 1: Intervalo explícito "das 10h às 16h", "10:00 - 16:00", "das 14 as 18 horas"
  const rangeMatch = cleaned.match(
    /(?:das?|de)?\s*([01]?\d|2[0-3])(?:[h:]([0-5]\d)?)?\s*(?:às|as|a|-|até)\s*([01]?\d|2[0-3])(?:[h:]([0-5]\d)?)?\s*(?:h|horas?)?/
  );

  if (rangeMatch && rangeMatch[1] && rangeMatch[3]) {
    const sH = parseInt(rangeMatch[1], 10);
    const sM = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    const eH = parseInt(rangeMatch[3], 10);
    const eM = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : 0;

    if (sH >= 0 && sH < 24 && eH >= 0 && eH < 24) {
      if (sH < eH) {
        return {
          timeRange: `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')} - ${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`,
          hasExplicitTime: true
        };
      } else {
        // Horário de início informado com fim menor ou igual: gera 1 hora de atendimento
        const nextH = sH + 1 < 24 ? sH + 1 : 23;
        return {
          timeRange: `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')} - ${String(nextH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`,
          hasExplicitTime: true
        };
      }
    }
  }

  // Caso 2: Hora única explícita "às 13h", "às 13:00", "13h", "19h30", "14:30"
  // 2a. Prefixo "às" ou "as"
  const asMatch = cleaned.match(/(?:às|as|para\s+as|para\s+às|para\s+a)\s*([01]?\d|2[0-3])(?:[h:]([0-5]\d)?)?/);
  if (asMatch && asMatch[1]) {
    const sH = parseInt(asMatch[1], 10);
    const sM = asMatch[2] ? parseInt(asMatch[2], 10) : 0;
    if (sH >= 0 && sH < 24 && sM >= 0 && sM < 60) {
      const nextH = sH + 1 < 24 ? sH + 1 : 23;
      return {
        timeRange: `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')} - ${String(nextH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`,
        hasExplicitTime: true
      };
    }
  }

  // 2b. Formato 14h, 14h30 ou 14:30 direto
  const directMatch = cleaned.match(/\b([01]?\d|2[0-3])(?:h([0-5]\d)?|:([0-5]\d))\b/);
  if (directMatch && directMatch[1]) {
    const sH = parseInt(directMatch[1], 10);
    const sM = directMatch[2] ? parseInt(directMatch[2], 10) : (directMatch[3] ? parseInt(directMatch[3], 10) : 0);
    if (sH >= 0 && sH < 24 && sM >= 0 && sM < 60) {
      const nextH = sH + 1 < 24 ? sH + 1 : 23;
      return {
        timeRange: `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')} - ${String(nextH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`,
        hasExplicitTime: true
      };
    }
  }

  // Caso 3: "14 horas"
  const horasMatch = cleaned.match(/\b([01]?\d|2[0-3])\s*horas?\b/);
  if (horasMatch && horasMatch[1]) {
    const sH = parseInt(horasMatch[1], 10);
    if (sH >= 0 && sH < 24) {
      const nextH = sH + 1 < 24 ? sH + 1 : 23;
      return {
        timeRange: `${String(sH).padStart(2, '0')}:00 - ${String(nextH).padStart(2, '0')}:00`,
        hasExplicitTime: true
      };
    }
  }

  // Default padrão seguro: 14:00 às 15:00
  return {
    timeRange: '14:00 - 15:00',
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
