import type { Room, RoomId, Evento } from '../types';

/**
 * Definição dos 4 Espaços Físicos do Instituto RenovaSer.
 * O 4º espaço (Auditório) é modular e abrange as 3 salas de atendimento.
 */
export const RENOVASER_ROOMS: Room[] = [
  {
    id: 'sala_1',
    name: 'Harmonia',
    code: 'Sala 1',
    label: 'Sala 1 • Harmonia',
    purpose: 'Acolhimento, Psicoterapia e Consultas Individuais',
    capacity: 'Até 3 pessoas',
    themeColor: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      dot: 'bg-emerald-500',
    },
  },
  {
    id: 'sala_2',
    name: 'Serenidade',
    code: 'Sala 2',
    label: 'Sala 2 • Serenidade',
    purpose: 'Terapias Holísticas, Tarô Terapêutico e Florais',
    capacity: 'Até 3 pessoas',
    themeColor: {
      bg: 'bg-teal-50',
      text: 'text-teal-800',
      border: 'border-teal-200',
      badge: 'bg-teal-100 text-teal-800 border-teal-300',
      dot: 'bg-teal-500',
    },
  },
  {
    id: 'sala_3',
    name: 'Vitalidade',
    code: 'Sala 3',
    label: 'Sala 3 • Vitalidade',
    purpose: 'Práticas Integrativas, Reiki e Alinhamento Energético',
    capacity: 'Até 3 pessoas (com maca/poltrona)',
    themeColor: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      dot: 'bg-amber-500',
    },
  },
  {
    id: 'auditorio',
    name: 'Conexão & Expansão',
    code: 'Auditório',
    label: 'Auditório Conexão (Salas 1, 2 e 3)',
    purpose: 'Workshops, Rodas de Conversa, Vivências e Cursos Coletivos',
    capacity: 'Salão Integrado Modular (Ocupa Salas 1, 2 e 3)',
    isIntegrated: true,
    subRooms: ['sala_1', 'sala_2', 'sala_3'],
    themeColor: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-800',
      border: 'border-indigo-200',
      badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      dot: 'bg-indigo-500',
    },
  },
];

export function getRoomById(roomId?: string | null): Room | undefined {
  if (!roomId) return undefined;
  return RENOVASER_ROOMS.find((r) => r.id === roomId);
}

/**
 * Converte string de horário (ex: "14:00 - 15:00" ou "14:00") em minutos do dia.
 */
export function parseTimeRange(timeStr: string): { startMinutes: number; endMinutes: number } {
  if (!timeStr) return { startMinutes: 0, endMinutes: 60 };

  const parts = timeStr.split('-');
  const startRaw = parts[0]?.trim() || '14:00';
  const endRaw = parts[1]?.trim() || '';

  const [sh, sm] = startRaw.split(':').map((v) => parseInt(v, 10));
  const startMinutes = (isNaN(sh) ? 0 : sh) * 60 + (isNaN(sm) ? 0 : sm);

  let endMinutes = startMinutes + 60; // padrão 1 hora
  if (endRaw) {
    const [eh, em] = endRaw.split(':').map((v) => parseInt(v, 10));
    const calculatedEnd = (isNaN(eh) ? 0 : eh) * 60 + (isNaN(em) ? 0 : em);
    if (calculatedEnd > startMinutes) {
      endMinutes = calculatedEnd;
    }
  }

  return { startMinutes, endMinutes };
}

/**
 * Verifica se dois intervalos de horário se sobrepõem.
 */
export function isTimeOverlap(
  rangeA: { startMinutes: number; endMinutes: number },
  rangeB: { startMinutes: number; endMinutes: number }
): boolean {
  return rangeA.startMinutes < rangeB.endMinutes && rangeA.endMinutes > rangeB.startMinutes;
}

export interface RoomAvailabilityStatus {
  room: Room;
  isAvailable: boolean;
  conflictReason?: string;
  conflictEvent?: Evento;
  isBlockedByAuditorium?: boolean;
}

export interface AvailabilityCheckResult {
  rooms: RoomAvailabilityStatus[];
  firstAvailableRoomId?: RoomId;
  availableCount: number;
  auditoriumAvailable: boolean;
  auditoriumBlockedBy: Array<{ roomId: RoomId; roomLabel: string; eventTitle: string; time: string }>;
  auditoriumActiveEvent?: Evento;
}

/**
 * Verifica em tempo real a disponibilidade de todas as 4 salas para uma data e horário específicos.
 * Aplica a regra espacial:
 * 1. Se o Auditório estiver reservado, Salas 1, 2 e 3 ficam bloqueadas.
 * 2. Se qualquer Sala 1, 2 ou 3 estiver reservada, o Auditório fica bloqueado.
 * 3. Salas 1, 2 e 3 podem funcionar em paralelo se o Auditório não estiver ocupado.
 */
export function checkRoomAvailability(
  date: string,
  time: string,
  events: Evento[],
  excludeEventId?: string
): AvailabilityCheckResult {
  const targetRange = parseTimeRange(time);

  // Filtrar eventos do mesmo dia, com modalidade presencial e horários sobrepostos
  const concurrentEvents = events.filter((e) => {
    if (e.id === excludeEventId) return false;
    if (e.date !== date) return false;
    if (e.type === 'online') return false; // Eventos estritamente online não ocupam espaço físico
    if (!e.roomId) return false;

    const eventRange = parseTimeRange(e.time);
    return isTimeOverlap(targetRange, eventRange);
  });

  // Verificar se há algum evento ocupando o Auditório
  const auditoriumEvent = concurrentEvents.find((e) => e.roomId === 'auditorio');

  // Identificar quais salas individuais (1, 2, 3) estão ocupadas
  const auditoriumBlockedBy: Array<{ roomId: RoomId; roomLabel: string; eventTitle: string; time: string }> = [];

  const individualRoomOccupancy = new Map<RoomId, Evento>();
  for (const e of concurrentEvents) {
    if (e.roomId && e.roomId !== 'auditorio') {
      individualRoomOccupancy.set(e.roomId as RoomId, e);
      const r = getRoomById(e.roomId);
      auditoriumBlockedBy.push({
        roomId: e.roomId as RoomId,
        roomLabel: r ? r.label : e.roomId,
        eventTitle: e.title,
        time: e.time,
      });
    }
  }

  const roomStatuses: RoomAvailabilityStatus[] = RENOVASER_ROOMS.map((room) => {
    // 1. Caso do Auditório
    if (room.id === 'auditorio') {
      if (auditoriumEvent) {
        return {
          room,
          isAvailable: false,
          conflictReason: `Auditório já reservado: "${auditoriumEvent.title}" (${auditoriumEvent.time})`,
          conflictEvent: auditoriumEvent,
        };
      }

      if (auditoriumBlockedBy.length > 0) {
        const roomsText = auditoriumBlockedBy.map((b) => b.roomLabel).join(', ');
        return {
          room,
          isAvailable: false,
          conflictReason: `Não disponível: ${auditoriumBlockedBy.length} sala(s) individual(is) em atendimento (${roomsText}). Para abrir o auditório, as 3 salas precisam estar livres.`,
        };
      }

      return {
        room,
        isAvailable: true,
      };
    }

    // 2. Caso de Sala Individual (Sala 1, Sala 2, Sala 3)
    // Se o auditório estiver ocupado, bloqueia esta sala!
    if (auditoriumEvent) {
      return {
        room,
        isAvailable: false,
        isBlockedByAuditorium: true,
        conflictReason: `Espaço integrado ao Auditório para: "${auditoriumEvent.title}" (${auditoriumEvent.time})`,
        conflictEvent: auditoriumEvent,
      };
    }

    // Se a própria sala estiver ocupada
    const occupied = individualRoomOccupancy.get(room.id);
    if (occupied) {
      return {
        room,
        isAvailable: false,
        conflictReason: `Ocupada por "${occupied.title}" (${occupied.time})`,
        conflictEvent: occupied,
      };
    }

    // Sala individual livre
    return {
      room,
      isAvailable: true,
    };
  });

  // Primeira sala individual disponível
  const firstAvailableIndividual = roomStatuses.find(
    (s) => s.room.id !== 'auditorio' && s.isAvailable
  );

  const availableCount = roomStatuses.filter((s) => s.isAvailable).length;
  const auditoriumStatus = roomStatuses.find((s) => s.room.id === 'auditorio');

  return {
    rooms: roomStatuses,
    firstAvailableRoomId: firstAvailableIndividual?.room.id,
    availableCount,
    auditoriumAvailable: auditoriumStatus ? auditoriumStatus.isAvailable : false,
    auditoriumBlockedBy,
    auditoriumActiveEvent: auditoriumEvent,
  };
}

/**
 * Validação rigorosa antes de persistir no banco de dados.
 */
export function validateRoomBooking(
  roomId: RoomId | undefined,
  type: 'presencial' | 'online',
  date: string,
  time: string,
  events: Evento[],
  excludeEventId?: string
): { valid: boolean; errorMessage?: string } {
  // Atendimentos 100% online não precisam bloquear salas físicas obrigatoriamente
  if (type === 'online') {
    return { valid: true };
  }

  if (!roomId) {
    return {
      valid: false,
      errorMessage: 'Selecione uma sala ou espaço para o atendimento presencial.',
    };
  }

  const check = checkRoomAvailability(date, time, events, excludeEventId);
  const targetStatus = check.rooms.find((r) => r.room.id === roomId);

  if (!targetStatus || !targetStatus.isAvailable) {
    return {
      valid: false,
      errorMessage: targetStatus?.conflictReason || 'A sala selecionada está indisponível neste horário.',
    };
  }

  return { valid: true };
}
