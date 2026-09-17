import type { CalendarEvent, ScheduleCategory, EventSubtype } from '../types';

export interface CategoryDefinition {
  id: ScheduleCategory;
  name: string;
  description: string;
  durationRule: string;
  badgeLabel: string;
  colorBg: string;
  colorText: string;
  colorBorder: string;
}

export interface EventSubtypeDefinition {
  id: EventSubtype;
  name: string;
  description: string;
  badgeLabel: string;
}

export const EVENT_SUBTYPES: Record<EventSubtype, EventSubtypeDefinition> = {
  workshop: {
    id: 'workshop',
    name: 'Workshop',
    description: 'Oficinas práticas e vivenciais com participação ativa',
    badgeLabel: 'Workshop',
  },
  treinamento: {
    id: 'treinamento',
    name: 'Treinamento',
    description: 'Capacitação prática e aprimoramento de habilidades',
    badgeLabel: 'Treinamento',
  },
  formacao: {
    id: 'formacao',
    name: 'Formação',
    description: 'Cursos formativos, módulos teóricos e metodológicos',
    badgeLabel: 'Formação',
  },
  transmissao_online: {
    id: 'transmissao_online',
    name: 'Transmissão on-line',
    description: 'Encontros remotos, lives, webinars e videoconferências',
    badgeLabel: 'Transmissão on-line',
  },
};

export const SCHEDULE_CATEGORIES: Record<ScheduleCategory, CategoryDefinition> = {
  atendimento: {
    id: 'atendimento',
    name: 'Atendimento',
    description: 'Atendimentos com hora marcada na sala do instituto',
    durationRule: 'Hora marcada conforme necessidade',
    badgeLabel: 'Atendimento',
    colorBg: 'bg-emerald-50',
    colorText: 'text-emerald-800',
    colorBorder: 'border-emerald-200',
  },
  reuniao: {
    id: 'reuniao',
    name: 'Reunião',
    description: 'Alinhamentos de equipe, diretoria ou parceiros',
    durationRule: 'Tempo definido conforme necessidade',
    badgeLabel: 'Reunião',
    colorBg: 'bg-amber-50',
    colorText: 'text-amber-800',
    colorBorder: 'border-amber-200',
  },
  evento: {
    id: 'evento',
    name: 'Evento',
    description: 'Workshops, treinamentos, formações e transmissões do instituto',
    durationRule: 'Conforme programação do evento',
    badgeLabel: 'Evento',
    colorBg: 'bg-purple-50',
    colorText: 'text-purple-800',
    colorBorder: 'border-purple-200',
  },
  comunicacao: {
    id: 'comunicacao',
    name: 'Comunicação',
    description: 'Avisos, comunicados oficiais e informativos da equipe',
    durationRule: 'Comunicado informativo',
    badgeLabel: 'Comunicação',
    colorBg: 'bg-blue-50',
    colorText: 'text-blue-800',
    colorBorder: 'border-blue-200',
  },
};

export interface ClassifiedEventInfo {
  category: ScheduleCategory;
  eventSubtype?: EventSubtype;
  label: string;
  durationLabel: string;
  badgeClass: string;
}

export function classifyCalendarEvent(ev: CalendarEvent): ClassifiedEventInfo {
  // If explicitly tagged
  if (ev.category) {
    if (ev.category === 'evento') {
      const sub = ev.eventSubtype;
      const subInfo = sub ? EVENT_SUBTYPES[sub] : null;
      return {
        category: 'evento',
        eventSubtype: sub,
        label: subInfo ? `Evento • ${subInfo.name}` : 'Evento',
        durationLabel: 'Conforme programação',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 font-semibold',
      };
    }
    if (ev.category === 'reuniao') {
      return {
        category: 'reuniao',
        label: 'Reunião',
        durationLabel: 'Tempo conforme necessidade',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
      };
    }
    if (ev.category === 'comunicacao') {
      return {
        category: 'comunicacao',
        label: 'Comunicação',
        durationLabel: 'Informativo',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200 font-semibold',
      };
    }
    return {
      category: 'atendimento',
      label: 'Atendimento',
      durationLabel: 'Hora marcada',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold',
    };
  }

  // Deduce from text (title + description)
  const fullText = `${ev.title || ''} ${ev.description || ''}`.toLowerCase();

  // 1. Check for Event Subtypes
  if (fullText.includes('workshop')) {
    return {
      category: 'evento',
      eventSubtype: 'workshop',
      label: 'Evento • Workshop',
      durationLabel: 'Conforme programação',
      badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 font-semibold',
    };
  }
  if (fullText.includes('treinamento')) {
    return {
      category: 'evento',
      eventSubtype: 'treinamento',
      label: 'Evento • Treinamento',
      durationLabel: 'Conforme programação',
      badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 font-semibold',
    };
  }
  if (fullText.includes('formação') || fullText.includes('formacao')) {
    return {
      category: 'evento',
      eventSubtype: 'formacao',
      label: 'Evento • Formação',
      durationLabel: 'Conforme programação',
      badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 font-semibold',
    };
  }
  if (
    fullText.includes('transmissão') ||
    fullText.includes('transmissao') ||
    fullText.includes('live') ||
    fullText.includes('webinar')
  ) {
    return {
      category: 'evento',
      eventSubtype: 'transmissao_online',
      label: 'Evento • Transmissão on-line',
      durationLabel: 'Conforme programação',
      badgeClass: 'bg-sky-50 text-sky-800 border-sky-200 font-semibold',
    };
  }
  if (fullText.includes('[evento]') || ev.isInstitutionalEvent) {
    return {
      category: 'evento',
      label: 'Evento Institucional',
      durationLabel: 'Conforme programação',
      badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 font-semibold',
    };
  }

  // 2. Check for Comunicação
  if (
    fullText.includes('comunicação') ||
    fullText.includes('comunicacao') ||
    fullText.includes('comunicado') ||
    fullText.includes('aviso oficial') ||
    fullText.includes('informativo')
  ) {
    return {
      category: 'comunicacao',
      label: 'Comunicação',
      durationLabel: 'Informativo',
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-200 font-semibold',
    };
  }

  // 3. Check for Reunião
  if (
    fullText.includes('reunião') ||
    fullText.includes('reuniao') ||
    fullText.includes('alinhamento') ||
    fullText.includes('diretoria')
  ) {
    return {
      category: 'reuniao',
      label: 'Reunião',
      durationLabel: 'Tempo conforme necessidade',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
    };
  }

  // 4. Default to Atendimento
  return {
    category: 'atendimento',
    label: 'Atendimento',
    durationLabel: 'Hora marcada',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold',
  };
}

export interface ParsedEventDetails {
  pauta: string;
  format: 'presencial' | 'online';
  formatLabel: string;
  locationLabel: string;
  isOnline: boolean;
  cleanDescription?: string;
}

export function parseEventDetails(ev: CalendarEvent): ParsedEventDetails {
  const desc = ev.description || '';
  const title = ev.title || '';
  const loc = ev.location || '';
  const hasMeet = !!ev.meetLink;

  // Determine format: online vs presencial
  const isOnline =
    hasMeet ||
    loc.toLowerCase().includes('online') ||
    loc.toLowerCase().includes('meet') ||
    desc.toLowerCase().includes('online') ||
    desc.toLowerCase().includes('google meet') ||
    desc.toLowerCase().includes('videoconferência') ||
    title.toLowerCase().includes('online') ||
    ev.eventSubtype === 'transmissao_online';

  const format: 'presencial' | 'online' = isOnline ? 'online' : 'presencial';
  const formatLabel = isOnline ? 'Online (Google Meet)' : 'Presencial';
  const locationLabel = isOnline
    ? 'Online • Google Meet'
    : loc && !loc.toLowerCase().includes('modalidade')
    ? loc
    : 'Sala do Instituto RenovaSer';

  // Extract / clean pauta
  let pauta = '';
  const pautaMatch = desc.match(/pauta:\s*([^\n\r]+)/i);
  if (pautaMatch && pautaMatch[1]) {
    pauta = pautaMatch[1].trim();
  }

  if (!pauta) {
    // Clean description from legacy boilerplate phrases
    const cleaned = desc
      .replace(/Modalidade:\s*[^\n\r]+/gi, '')
      .replace(/Profissional Responsável:\s*[^\n\r]+/gi, '')
      .replace(/Local:\s*[^\n\r]+/gi, '')
      .replace(/Instituto RenovaSer • Agenda Interna Oficial/gi, '')
      .replace(/Agendamento confirmado via Agenda Interna do Instituto RenovaSer\.?/gi, '')
      .replace(/Participantes:\s*[^\n\r]+/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (cleaned && cleaned.length > 3) {
      pauta = cleaned;
    }
  }

  // Meaningful fallback if empty
  if (!pauta) {
    if (
      ev.category === 'reuniao' ||
      title.toLowerCase().includes('reunião') ||
      title.toLowerCase().includes('reuniao')
    ) {
      const cleanTitle = title.replace(/^\[Reunião\]\s*/i, '').trim();
      pauta = `Discussão de pautas e planejamento da equipe (${cleanTitle})`;
    } else if (ev.category === 'atendimento' || title.toLowerCase().includes('atendimento')) {
      pauta = 'Atendimento clínico com hora marcada';
    } else if (ev.category === 'comunicacao') {
      pauta = 'Comunicação oficial da equipe';
    } else {
      pauta = title.replace(/^\[(Evento|Atendimento|Reunião|Comunicação)\]\s*/i, '').trim();
    }
  }

  return {
    pauta,
    format,
    formatLabel,
    locationLabel,
    isOnline,
    cleanDescription: pauta,
  };
}
