import React from 'react';
import { DoorOpen, Layers, Check, Clock, User, ChevronRight } from 'lucide-react';
import type { Evento, RoomId, TherapistUser } from '../types';
import { RENOVASER_ROOMS, getRoomById } from '../lib/roomService';

interface RoomsOccupancyBarProps {
  events: Evento[];
  selectedDate: string;
  therapists: TherapistUser[];
  onSelectRoomFilter?: (roomId: RoomId | 'todos') => void;
  selectedRoomFilter?: string;
  onQuickBookRoom?: (roomId: RoomId) => void;
}

export function RoomsOccupancyBar({
  events,
  selectedDate,
  therapists,
  onSelectRoomFilter,
  selectedRoomFilter = 'todos',
  onQuickBookRoom,
}: RoomsOccupancyBarProps) {
  // Filtrar eventos presenciais do dia selecionado
  const dayEvents = events.filter((e) => e.date === selectedDate && e.type !== 'online');

  const therapistMap = therapists.reduce<Record<string, string>>((acc, t) => {
    acc[t.id] = t.name;
    return acc;
  }, {});

  // Eventos por sala no dia
  const eventsByRoom = RENOVASER_ROOMS.reduce<Record<RoomId, Evento[]>>((acc, room) => {
    acc[room.id] = dayEvents.filter((e) => e.roomId === room.id);
    return acc;
  }, {
    sala_1: [],
    sala_2: [],
    sala_3: [],
    auditorio: [],
  });

  const auditoriumEvents = eventsByRoom['auditorio'];
  const hasAuditoriumToday = auditoriumEvents.length > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <DoorOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 leading-tight">
              Espaços & Salas RenovaSer • {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
            </h3>
            <p className="text-[10px] text-slate-500">
              3 salas individuais para atendimento e 1 auditório modular integrado
            </p>
          </div>
        </div>

        {/* Filtro rápido por sala */}
        {onSelectRoomFilter && (
          <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
            <button
              onClick={() => onSelectRoomFilter('todos')}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                selectedRoomFilter === 'todos'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos os Espaços
            </button>
            {RENOVASER_ROOMS.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelectRoomFilter(r.id)}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  selectedRoomFilter === r.id
                    ? `${r.themeColor.bg} ${r.themeColor.text} ring-1 ring-inset ${r.themeColor.border} font-bold`
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {r.code}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cards das 4 Salas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {RENOVASER_ROOMS.map((room) => {
          const roomEvents = eventsByRoom[room.id] || [];
          const isAudit = room.id === 'auditorio';

          return (
            <div
              key={room.id}
              className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                selectedRoomFilter === room.id
                  ? 'ring-2 ring-emerald-500/30 border-emerald-400 bg-white'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-white'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${room.themeColor.dot}`}></span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {room.code}
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full border ${
                    roomEvents.length > 0
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {roomEvents.length > 0 ? `${roomEvents.length} agendado(s)` : 'Livre hoje'}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 leading-snug">
                  {room.name}
                </h4>
                <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                  {room.purpose}
                </p>

                {/* Lista de Atendimentos na Sala Hoje */}
                <div className="mt-2 space-y-1 max-h-24 overflow-y-auto pr-0.5">
                  {roomEvents.length === 0 ? (
                    <div className="text-[10px] text-slate-400 italic py-1">
                      Nenhum atendimento agendado nesta sala hoje.
                    </div>
                  ) : (
                    roomEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="text-[10px] bg-white p-1.5 rounded-lg border border-slate-200/80 shadow-2xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between font-mono text-emerald-800 font-bold">
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-emerald-600" />
                            {evt.time}
                          </span>
                          <span className="text-[9px] text-slate-500 font-sans truncate max-w-[80px]">
                            {therapistMap[evt.therapistId]?.split(' ')[0] || 'Equipe'}
                          </span>
                        </div>
                        <p className="text-slate-700 font-medium truncate" title={evt.title}>
                          {evt.title}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Botão de Agendamento Rápido na Sala */}
              {onQuickBookRoom && (
                <div className="pt-2 mt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onQuickBookRoom(room.id)}
                    className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>Agendar nesta sala</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                  <span className="text-[9px] text-slate-400">
                    {room.capacity.split(' ')[0]} {room.capacity.split(' ')[1]}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasAuditoriumToday && (
        <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>Aviso de Espaço Modular:</strong> Há eventos previstos para o Auditório neste dia. Durante os horários do Auditório, as divisórias móveis são abertas e as Salas 1, 2 e 3 ficam integradas ao salão coletivo.
          </span>
        </div>
      )}
    </div>
  );
}
