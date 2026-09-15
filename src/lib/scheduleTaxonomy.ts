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
    durationRule: '60 a 90 minutos',
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
      durationLabel: '60 a 90 min',
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
    durationLabel: '60 a 90 min',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold',
  };
}
