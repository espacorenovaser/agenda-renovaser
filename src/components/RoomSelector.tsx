import React from 'react';
import { 
  DoorClosed, 
  DoorOpen, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Users, 
  Layers, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import type { RoomId, Evento } from '../types';
import { 
  RENOVASER_ROOMS, 
  checkRoomAvailability, 
  getRoomById 
} from '../lib/roomService';

interface RoomSelectorProps {
  selectedRoomId?: RoomId;
  onChangeRoom: (roomId: RoomId) => void;
  date: string;
  time: string;
  events: Evento[];
  excludeEventId?: string;
  isOnlineMode?: boolean;
}

export function RoomSelector({
  selectedRoomId,
  onChangeRoom,
  date,
  time,
  events,
  excludeEventId,
  isOnlineMode
}: RoomSelectorProps) {
  const availability = checkRoomAvailability(date, time, events, excludeEventId);
  const currentRoom = getRoomById(selectedRoomId);

  // Salas individuais (1, 2 e 3)
  const individualRooms = availability.rooms.filter((s) => s.room.id !== 'auditorio');
  // Auditório
  const auditoriumStatus = availability.rooms.find((s) => s.room.id === 'auditorio');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
            <DoorOpen className="w-4 h-4 text-emerald-600" />
            Alocação de Espaço Físico (Salas do RenovaSer)
          </label>
          <p className="text-[11px] text-slate-500">
            Verificação em tempo real para {date} às {time || 'horário selecionado'}
          </p>
        </div>

        {/* Sugestão de sala livre rápida */}
        {availability.firstAvailableRoomId && selectedRoomId !== availability.firstAvailableRoomId && (
          <button
            type="button"
            onClick={() => onChangeRoom(availability.firstAvailableRoomId!)}
            className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Selecionar automaticamente a primeira sala livre"
          >
            <Sparkles className="w-3 h-3 text-emerald-500" />
            <span>Sugerir sala livre</span>
          </button>
        )}
      </div>

      {isOnlineMode && (
        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
          <span>
            <strong>Modalidade Online:</strong> Não é obrigatório reservar sala física, a menos que o terapeuta vá atender de dentro do espaço do Instituto.
          </span>
        </div>
      )}

      {/* Grid das 3 Salas de Atendimento Individual */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <DoorClosed className="w-3 h-3" /> Salas Individuais de Atendimento (1, 2 e 3)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {individualRooms.map(({ room, isAvailable, conflictReason, isBlockedByAuditorium }) => {
            const isSelected = selectedRoomId === room.id;

            return (
              <button
                key={room.id}
                type="button"
                onClick={() => {
                  onChangeRoom(room.id);
                }}
                className={`relative p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[105px] ${
                  isSelected
                    ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/40 shadow-sm'
                    : isAvailable
                    ? 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-slate-50/60'
                    : 'border-rose-200 bg-rose-50/30 hover:border-rose-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {room.code}
                    </span>
                    {isAvailable ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Livre
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-100/70 px-1.5 py-0.2 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        Ocupada
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-slate-800 leading-tight">
                    {room.name}
                  </h4>
                  <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                    {room.purpose}
                  </p>
                </div>

                <div className="pt-2 mt-1 border-t border-slate-100/80 flex items-center justify-between text-[10px]">
                  {isAvailable ? (
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <strong className="text-emerald-800">Selecionada</strong>
                        </>
                      ) : (
                        'Disponível para uso'
                      )}
                    </span>
                  ) : (
                    <span className="text-rose-600 font-medium truncate" title={conflictReason}>
                      {isBlockedByAuditorium ? 'Salão Integrado em uso' : 'Em atendimento'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4º Espaço: Auditório / Salão Integrado Modular */}
      {auditoriumStatus && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3" /> Salão Modular Integrado (Abrange Salas 1, 2 e 3)
            </span>
            <span className="text-[10px] text-slate-400">
              Para cursos, vivências e palestras
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              onChangeRoom('auditorio');
            }}
            className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              selectedRoomId === 'auditorio'
                ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/50 shadow-sm'
                : auditoriumStatus.isAvailable
                ? 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50/60'
                : 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Auditório Conexão & Expansão
                </span>
                {auditoriumStatus.isAvailable ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Salão Totalmente Livre
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Indisponível (Salas Individuais em uso)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-700 font-medium">
                {auditoriumStatus.room.purpose}
              </p>
              {auditoriumStatus.conflictReason && (
                <p className="text-[11px] text-amber-900 bg-amber-100/60 p-2 rounded-lg border border-amber-200/60 flex items-start gap-1.5 mt-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <span>{auditoriumStatus.conflictReason}</span>
                </p>
              )}
            </div>

            <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
              {selectedRoomId === 'auditorio' ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-800 bg-indigo-100 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700" />
                  Auditório Selecionado
                </span>
              ) : (
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 hover:text-indigo-700">
                  Reservar Salão <ArrowRight className="w-3 h-3" />
                </span>
              )}
              <span className="text-[10px] text-slate-400 mt-1">
                Capacidade ampliada
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Alerta de Conflito Ativo se o usuário selecionou uma sala indisponível */}
      {currentRoom && !availability.rooms.find((r) => r.room.id === selectedRoomId)?.isAvailable && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong>Atenção: Conflito de Espaço Físico!</strong>
            <p className="text-[11px]">
              {availability.rooms.find((r) => r.room.id === selectedRoomId)?.conflictReason}
            </p>
            {availability.firstAvailableRoomId && (
              <button
                type="button"
                onClick={() => onChangeRoom(availability.firstAvailableRoomId!)}
                className="mt-1 text-xs font-bold text-emerald-800 underline hover:text-emerald-900 inline-block cursor-pointer"
              >
                Mudar agora para {getRoomById(availability.firstAvailableRoomId)?.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
