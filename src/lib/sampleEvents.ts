import type { CalendarEvent } from '../types';

export function getSampleEvents(): CalendarEvent[] {
  const now = new Date();

  // Helper to format ISO with offset -03:00
  const makeDate = (dayOffset: number, hour: number, minute: number = 0) => {
    const d = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(hour).padStart(2, '0');
    const m = String(minute).padStart(2, '0');
    return `${year}-${month}-${day}T${h}:${m}:00-03:00`;
  };

  return [
    {
      id: 'demo-1',
      title: '[Atendimento] Atendimento Psicológico Individual',
      start: makeDate(0, 10, 0),
      end: makeDate(0, 11, 0),
      attendees: ['cleci@institutorenovaser.com.br', 'paciente1@exemplo.com'],
      description: 'Atendimento com hora marcada na sala do Instituto RenovaSer. Duração: 60 minutos.',
      location: 'Sala de Atendimentos RenovaSer',
      category: 'atendimento',
    },
    {
      id: 'demo-2',
      title: '[Atendimento] Fisioterapia e Práticas Integrativas',
      start: makeDate(0, 14, 0),
      end: makeDate(0, 15, 30),
      attendees: ['claudir@institutorenovaser.com.br', 'paciente2@exemplo.com'],
      description: 'Atendimento especializado de 90 minutos na sala principal.',
      location: 'Sala de Atendimentos RenovaSer',
      category: 'atendimento',
    },
    {
      id: 'demo-3',
      title: '[Reunião] Alinhamento Semanal da Equipe',
      start: makeDate(1, 9, 30),
      end: makeDate(1, 10, 15),
      attendees: [
        'claudir@institutorenovaser.com.br',
        'cleci@institutorenovaser.com.br',
        'gorete@institutorenovaser.com.br',
      ],
      description: 'Reunião semanal com tempo definido para planejamento dos atendimentos e escalas.',
      location: 'Sala de Reuniões / Híbrido',
      meetLink: 'https://meet.google.com/rnv-alnh-eqp',
      category: 'reuniao',
    },
    {
      id: 'demo-4',
      title: '[Atendimento] Consulta Psicológica de Retorno',
      start: makeDate(1, 15, 0),
      end: makeDate(1, 16, 0),
      attendees: ['cleci@institutorenovaser.com.br', 'paciente3@exemplo.com'],
      description: 'Atendimento com hora marcada na sala. Duração: 60 minutos.',
      location: 'Sala de Atendimentos RenovaSer',
      category: 'atendimento',
    },
    {
      id: 'demo-5',
      title: '[Evento - Workshop] Workshop de Saúde Integral e Autocuidado',
      start: makeDate(2, 14, 0),
      end: makeDate(2, 16, 30),
      attendees: [
        'claudir@institutorenovaser.com.br',
        'gorete@institutorenovaser.com.br',
        'comunidade@institutorenovaser.com.br',
      ],
      description: 'Workshop presencial com transmissão simultânea para inscritos.',
      location: 'Auditório Instituto RenovaSer',
      meetLink: 'https://meet.google.com/rnv-wksp-sau',
      category: 'evento',
      eventSubtype: 'workshop',
    },
    {
      id: 'demo-6',
      title: '[Evento - Transmissão on-line] Roda de Conversa: Práticas Integrativas',
      start: makeDate(3, 19, 0),
      end: makeDate(3, 20, 30),
      attendees: ['cleci@institutorenovaser.com.br', 'publico@institutorenovaser.com.br'],
      description: 'Transmissão ao vivo pelo Google Meet com link aberto aos participantes.',
      meetLink: 'https://meet.google.com/rnv-trns-onl',
      category: 'evento',
      eventSubtype: 'transmissao_online',
    },
  ];
}
