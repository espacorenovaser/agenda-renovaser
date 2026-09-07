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
      title: '[Atendimento] Atendimento Psicológico com Dr. Lucas Ramos',
      start: makeDate(0, 10, 0),
      end: makeDate(0, 11, 0),
      attendees: ['lucas.psico@institutorenovaser.com.br', 'claudirisrael@gmail.com', 'clecimarchioro@gmail.com', 'mmgorete00@gmail.com'],
      description: 'Atendimento clínico com hora marcada na sala do Instituto RenovaSer. Duração: 60 minutos.\nProfissional: Dr. Lucas Ramos (Psicólogo)',
      location: 'Sala de Atendimentos RenovaSer',
      category: 'atendimento',
      professionalName: 'Dr. Lucas Ramos',
      professionalEmail: 'lucas.psico@institutorenovaser.com.br',
    },
    {
      id: 'demo-2',
      title: '[Atendimento] Fisioterapia Integrativa com Dra. Mariana Silva',
      start: makeDate(0, 14, 0),
      end: makeDate(0, 15, 30),
      attendees: ['mariana.fisio@institutorenovaser.com.br', 'claudirisrael@gmail.com', 'clecimarchioro@gmail.com', 'mmgorete00@gmail.com'],
      description: 'Atendimento especializado de 90 minutos na sala do instituto.\nProfissional: Dra. Mariana Silva (Fisioterapeuta)',
      location: 'Sala de Atendimentos RenovaSer',
      category: 'atendimento',
      professionalName: 'Dra. Mariana Silva',
      professionalEmail: 'mariana.fisio@institutorenovaser.com.br',
    },
    {
      id: 'demo-3',
      title: '[Reunião] Alinhamento Semanal da Diretoria e Equipe',
      start: makeDate(1, 9, 30),
      end: makeDate(1, 10, 15),
      attendees: [
        'claudirisrael@gmail.com',
        'clecimarchioro@gmail.com',
        'mmgorete00@gmail.com',
      ],
      description: 'Reunião semanal com tempo definido para planejamento dos atendimentos e escalas.',
      location: 'Sala do Instituto RenovaSer / Híbrido',
      meetLink: 'https://meet.google.com/rnv-alnh-eqp',
      category: 'reuniao',
      isInstitutionalEvent: true,
    },
    {
      id: 'demo-4',
      title: '[Atendimento] Psicoterapia com Dr. Lucas Ramos',
      start: makeDate(1, 15, 0),
      end: makeDate(1, 16, 0),
      attendees: ['lucas.psico@institutorenovaser.com.br', 'claudirisrael@gmail.com', 'clecimarchioro@gmail.com', 'mmgorete00@gmail.com'],
      description: 'Atendimento com hora marcada na sala. Duração: 60 minutos.\nProfissional: Dr. Lucas Ramos (Psicólogo)',
      location: 'Sala de Atendimentos RenovaSer',
      category: 'atendimento',
      professionalName: 'Dr. Lucas Ramos',
      professionalEmail: 'lucas.psico@institutorenovaser.com.br',
    },
    {
      id: 'demo-5',
      title: '[Evento: Workshop] Workshop de Saúde Integral e Autocuidado',
      start: makeDate(2, 14, 0),
      end: makeDate(2, 16, 30),
      attendees: [
        'claudirisrael@gmail.com',
        'clecimarchioro@gmail.com',
        'mmgorete00@gmail.com',
        'lucas.psico@institutorenovaser.com.br',
        'mariana.fisio@institutorenovaser.com.br',
      ],
      description: 'Workshop vivencial aberto a todos os profissionais e pacientes do Instituto RenovaSer.',
      location: 'Auditório Instituto RenovaSer',
      meetLink: 'https://meet.google.com/rnv-wksp-sau',
      category: 'evento',
      eventSubtype: 'workshop',
      isInstitutionalEvent: true,
    },
    {
      id: 'demo-6',
      title: '[Evento: Transmissão on-line] Roda de Conversa: Práticas Integrativas',
      start: makeDate(3, 19, 0),
      end: makeDate(3, 20, 30),
      attendees: ['claudirisrael@gmail.com', 'clecimarchioro@gmail.com', 'mmgorete00@gmail.com'],
      description: 'Transmissão ao vivo com link do Google Meet para equipe e comunidade.',
      meetLink: 'https://meet.google.com/rnv-trns-onl',
      category: 'evento',
      eventSubtype: 'transmissao_online',
      isInstitutionalEvent: true,
    },
  ];
}
