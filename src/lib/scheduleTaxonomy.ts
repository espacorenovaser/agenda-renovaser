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
    badgeLabel: 'Atendimento (60-90 min)',
    colorBg: 'bg-[#EBF0E9]',
    colorText: 'text-[#3D5A3F]',
    colorBorder: 'border-[#C2D6C0]',
  },
  reuniao: {
    id: 'reuniao',
    name: 'Reunião',
    description: 'Alinhamentos de equipe, diretoria ou parceiros',
    durationRule: 'Tempo definido conforme necessidade',
    badgeLabel: 'Reunião',
    colorBg: 'bg-[#FDF6E2]',
    colorText: 'text-[#8C6D23]',
    colorBorder: 'border-[#E8D9A8]',
  },
  evento: {
    id: 'evento',
    name: 'Evento',
    description: 'Workshops, treinamentos, formações e transmissões do instituto',
    durationRule: 'Conforme programação do evento',
    badgeLabel: 'Evento',
    colorBg: 'bg-[#F2EEFA]',
    colorText: 'text-[#6B4B9A]',
    colorBorder: 'border-[#D8CEEE]',
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
        badgeClass: 'bg-[#F2EEFA] text-[#6B4B9A] border-[#D8CEEE]',
      };
    }
    if (ev.category === 'reuniao') {
      return {
        category: 'reuniao',
        label: 'Reunião',
        durationLabel: 'Tempo conforme necessidade',
        badgeClass: 'bg-[#FDF6E2] text-[#8C6D23] border-[#E8D9A8]',
      };
    }
    return {
      category: 'atendimento',
      label: 'Atendimento (60 a 90 min)',
      durationLabel: '60 a 90 min',
      badgeClass: 'bg-[#EBF0E9] text-[#3D5A3F] border-[#C2D6C0]',
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
      badgeClass: 'bg-[#F2EEFA] text-[#6B4B9A] border-[#D8CEEE]',
    };
  }
  if (fullText.includes('treinamento')) {
    return {
      category: 'evento',
      eventSubtype: 'treinamento',
      label: 'Evento • Treinamento',
      durationLabel: 'Conforme programação',
      badgeClass: 'bg-[#F2EEFA] text-[#6B4B9A] border-[#D8CEEE]',
    };
  }
  if (fullText.includes('formação') || fullText.includes('formacao')) {
    return {
      category: 'evento',
      eventSubtype: 'formacao',
      label: 'Evento • Formação',
      durationLabel: 'Conforme programação',
      badgeClass: 'bg-[#F2EEFA] text-[#6B4B9A] border-[#D8CEEE]',
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
      badgeClass: 'bg-[#F2EEFA] text-[#6B4B9A] border-[#D8CEEE]',
    };
  }
  if (fullText.includes('[evento]') || ev.isInstitutionalEvent) {
    return {
      category: 'evento',
      label: 'Evento Institucional',
      durationLabel: 'Conforme programação',
      badgeClass: 'bg-[#F2EEFA] text-[#6B4B9A] border-[#D8CEEE]',
    };
  }

  // 2. Check for Reunião
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
      badgeClass: 'bg-[#FDF6E2] text-[#8C6D23] border-[#E8D9A8]',
    };
  }

  // 3. Default to Atendimento (60 a 90 min)
  return {
    category: 'atendimento',
    label: 'Atendimento (60 a 90 min)',
    durationLabel: '60 a 90 min',
    badgeClass: 'bg-[#EBF0E9] text-[#3D5A3F] border-[#C2D6C0]',
  };
}
