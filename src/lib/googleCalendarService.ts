import type { Evento, RoomId } from '../types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/**
 * Converte data (YYYY-MM-DD) e intervalo de horário ("10:00 - 16:00" ou "14:00")
 * em timestamps ISO para o Google Calendar com fuso horário brasileiro.
 */
export function parseDateTimeForGCal(date: string, time: string): { startDateTime: string; endDateTime: string } {
  const timeZone = 'America/Sao_Paulo';
  
  // Normalizar date
  const cleanDate = date && date.match(/^\d{4}-\d{2}-\d{2}$/) ? date : new Date().toISOString().split('T')[0];
  
  let startHour = '14:00';
  let endHour = '15:00';

  if (time && time.includes('-')) {
    const [start, end] = time.split('-').map((s) => s.trim());
    if (start) {
      const matchStart = start.match(/(\d{1,2}):(\d{2})/);
      if (matchStart) startHour = `${matchStart[1].padStart(2, '0')}:${matchStart[2]}`;
    }
    if (end) {
      const matchEnd = end.match(/(\d{1,2}):(\d{2})/);
      if (matchEnd) endHour = `${matchEnd[1].padStart(2, '0')}:${matchEnd[2]}`;
    }
  } else if (time) {
    const match = time.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const h = parseInt(match[1], 10);
      startHour = `${h.toString().padStart(2, '0')}:${match[2]}`;
      endHour = `${(h + 1).toString().padStart(2, '0')}:${match[2]}`;
    }
  }

  // Monta ISO local para envio com timezone explícito
  return {
    startDateTime: `${cleanDate}T${startHour}:00`,
    endDateTime: `${cleanDate}T${endHour}:00`
  };
}

/**
 * Cria um evento diretamente no Google Calendar (Google Agenda) do usuário
 */
export async function createGoogleCalendarEvent(
  event: {
    title: string;
    category?: string;
    date: string;
    time: string;
    location?: string;
    roomName?: string;
    clientEmail?: string;
    clientWhatsApp?: string;
  },
  accessToken: string
): Promise<{ googleEventId: string; htmlLink: string }> {
  const { startDateTime, endDateTime } = parseDateTimeForGCal(event.date, event.time);
  const timeZone = 'America/Sao_Paulo';

  const descriptionParts = [
    `📅 Agendado via Instituto RenovaSer`,
    event.roomName ? `Espaço Físico: ${event.roomName}` : null,
    event.category ? `Tipo: ${event.category.toUpperCase()}` : null,
    event.clientWhatsApp ? `WhatsApp Cliente: ${event.clientWhatsApp}` : null,
    event.clientEmail ? `E-mail Cliente: ${event.clientEmail}` : null
  ].filter(Boolean).join('\n');

  const payload = {
    summary: event.title,
    description: descriptionParts,
    location: event.roomName || event.location || 'Instituto RenovaSer',
    start: {
      dateTime: `${startDateTime}-03:00`,
      timeZone
    },
    end: {
      dateTime: `${endDateTime}-03:00`,
      timeZone
    }
  };

  const response = await fetch(CALENDAR_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const msg = errorData?.error?.message || `Erro HTTP ${response.status}`;
    console.error('Falha ao criar evento no Google Calendar:', errorData);
    throw new Error(`Google Calendar: ${msg}`);
  }

  const created = await response.json();
  return {
    googleEventId: created.id,
    htmlLink: created.htmlLink || `https://calendar.google.com/calendar/u/0/r`
  };
}

/**
 * Remove um evento do Google Calendar
 */
export async function deleteGoogleCalendarEvent(googleEventId: string, accessToken: string): Promise<void> {
  const url = `${CALENDAR_API_BASE}/${encodeURIComponent(googleEventId)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const errorData = await response.json().catch(() => null);
    const msg = errorData?.error?.message || `Erro HTTP ${response.status}`;
    console.error('Falha ao excluir evento no Google Calendar:', errorData);
    throw new Error(`Google Calendar: ${msg}`);
  }
}

/**
 * Busca eventos do Google Calendar para sincronizar com a agenda do aplicativo
 */
export async function fetchGoogleCalendarEvents(accessToken: string): Promise<Evento[]> {
  // Busca eventos dos últimos 30 dias até 90 dias à frente
  const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const url = `${CALENDAR_API_BASE}?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const msg = errorData?.error?.message || `Erro HTTP ${response.status}`;
    throw new Error(`Google Calendar: ${msg}`);
  }

  const data = await response.json();
  const items = data.items || [];

  return items.map((item: any) => {
    const startStr = item.start?.dateTime || item.start?.date || '';
    const endStr = item.end?.dateTime || item.end?.date || '';
    
    let dateStr = new Date().toISOString().split('T')[0];
    let timeStr = '14:00 - 15:00';

    if (startStr.includes('T')) {
      const startDate = new Date(startStr);
      dateStr = startStr.split('T')[0];
      const startH = startDate.getHours().toString().padStart(2, '0');
      const startM = startDate.getMinutes().toString().padStart(2, '0');

      let endH = (startDate.getHours() + 1).toString().padStart(2, '0');
      let endM = startM;
      if (endStr.includes('T')) {
        const endDate = new Date(endStr);
        endH = endDate.getHours().toString().padStart(2, '0');
        endM = endDate.getMinutes().toString().padStart(2, '0');
      }
      timeStr = `${startH}:${startM} - ${endH}:${endM}`;
    } else if (startStr) {
      dateStr = startStr;
      timeStr = '10:00 - 16:00';
    }

    // Identificar sala pela localização ou título
    let roomId: RoomId | undefined = undefined;
    let roomName: string | undefined = item.location || undefined;
    const locLower = (item.location || '' + ' ' + (item.summary || '')).toLowerCase();

    if (locLower.includes('sala 1') || locLower.includes('harmonia')) {
      roomId = 'sala_1';
      roomName = 'Sala 1 • Harmonia';
    } else if (locLower.includes('sala 2') || locLower.includes('serenidade')) {
      roomId = 'sala_2';
      roomName = 'Sala 2 • Serenidade';
    } else if (locLower.includes('sala 3') || locLower.includes('vitalidade')) {
      roomId = 'sala_3';
      roomName = 'Sala 3 • Vitalidade';
    } else if (locLower.includes('auditório') || locLower.includes('auditorio')) {
      roomId = 'auditorio';
      roomName = 'Auditório • Conexão & Expansão';
    }

    const summaryLower = (item.summary || '').toLowerCase();
    const isReuniao = summaryLower.includes('reuni') || summaryLower.includes('equipe');
    const isEvento = summaryLower.includes('evento') || summaryLower.includes('workshop') || summaryLower.includes('sábado');

    const category: 'atendimento' | 'reuniao' | 'evento' = isReuniao ? 'reuniao' : isEvento ? 'evento' : 'atendimento';

    return {
      id: `gcal-${item.id}`,
      title: item.summary || 'Compromisso do Google Agenda',
      category,
      date: dateStr,
      time: timeStr,
      location: roomName || item.location || 'Instituto RenovaSer',
      type: item.location?.toLowerCase().includes('online') || item.hangoutLink ? 'online' : 'presencial',
      therapistId: 'admin1',
      roomId,
      roomName,
      badgeColor: category === 'reuniao'
        ? 'bg-blue-100 text-blue-800 border-blue-200'
        : category === 'evento'
        ? 'bg-purple-100 text-purple-800 border-purple-200'
        : 'bg-emerald-100 text-emerald-800 border-emerald-200',
      createdAt: item.created || new Date().toISOString(),
      googleEventId: item.id,
      googleHtmlLink: item.htmlLink,
      syncedWithGoogle: true
    } as Evento;
  });
}
