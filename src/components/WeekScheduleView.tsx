import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  MapPin, 
  Video, 
  Plus, 
  MessageCircle,
  Calendar as CalendarIcon,
  DoorOpen,
  Layers
} from 'lucide-react';
import type { Evento, TherapistUser } from '../types';
import { getRoomById } from '../lib/roomService';

interface WeekScheduleViewProps {
  events: Evento[];
  onSelectEvent: (event: Evento) => void;
  onAddEventAtDate?: (dateStr: string) => void;
  therapists: TherapistUser[];
}

export function WeekScheduleView({
  events,
  onSelectEvent,
  onAddEventAtDate,
  therapists
}: WeekScheduleViewProps) {
  // Data base para a semana atual
  const [currentDate, setCurrentDate] = useState(new Date());

  const therapistMap = therapists.reduce<Record<string, string>>((acc, t) => {
    acc[t.id] = t.name;
    return acc;
  }, {});

  // Calcula a segunda-feira da semana de currentDate
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay(); // 0 = Domingo, 1 = Segunda, ...
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // ajusta quando domingo
    return new Date(date.setDate(diff));
  };

  const monday = getMonday(currentDate);

  // Gera os 6 dias úteis/atendimento: Segunda (0) até Sábado (5)
  const weekDays = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const isoDate = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const dayNumber = d.getDate();
    const monthNumber = (d.getMonth() + 1).toString().padStart(2, '0');
    const isToday = new Date().toISOString().split('T')[0] === isoDate;

    return {
      date: d,
      isoDate,
      dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
      formattedHeader: `${dayNumber}/${monthNumber}`,
      isToday
    };
  });

  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const handleCurrentWeek = () => {
    setCurrentDate(new Date());
  };

  const firstDayStr = weekDays[0].formattedHeader;
  const lastDayStr = weekDays[5].formattedHeader;

  return (
    <div className="space-y-4">
      {/* Barra de Navegação da Semana */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Semana anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleCurrentWeek}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            Esta Semana
          </button>
          <button
            onClick={handleNextWeek}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Próxima semana"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="ml-2">
            <h3 className="text-sm font-bold text-slate-900">
              Semana: {firstDayStr} até {lastDayStr}
            </h3>
            <p className="text-[11px] text-slate-500">
              Tabela de 6 colunas (Segunda a Sábado)
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          Clique no quadro para ver todas as informações do agendamento
        </div>
      </div>

      {/* Tabela em 6 Colunas: Segunda a Sábado */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="grid grid-cols-6 min-w-[760px] divide-x divide-slate-200">
            {weekDays.map((col) => {
              const dayEvents = events.filter((e) => e.date === col.isoDate);
              // Ordenar eventos pelo horário
              dayEvents.sort((a, b) => a.time.localeCompare(b.time));

              return (
                <div key={col.isoDate} className="flex flex-col min-h-[480px]">
                  {/* Cabeçalho do Dia */}
                  <div className={`p-3 border-b border-slate-200 text-center ${
                    col.isToday ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-700'
                  }`}>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs font-bold">{col.dayName}</span>
                      {col.isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      )}
                    </div>
                    <span className={`text-sm font-extrabold ${col.isToday ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {col.formattedHeader}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}
                    </div>
                  </div>

                  {/* Corpo da Coluna: Quadros de Agendamento */}
                  <div className="flex-1 p-2 space-y-2 bg-slate-50/30">
                    {dayEvents.map((evt) => (
                      <div
                        key={evt.id}
                        onClick={() => onSelectEvent(evt)}
                        className="bg-white p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 shadow-sm hover:shadow-md transition-all cursor-pointer space-y-1.5 text-left group"
                      >
                        {/* Sinalização e Hora */}
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border truncate ${evt.badgeColor}`}>
                            {evt.category.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-mono">
                            <Clock className="w-2.5 h-2.5 text-emerald-600" />
                            {evt.time.split('-')[0]?.trim() || evt.time}
                          </span>
                        </div>

                        {/* Título do Evento */}
                        <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors">
                          {evt.title}
                        </h4>

                        {/* Horário Completo */}
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <span className="font-mono text-slate-600 font-medium">
                            {evt.time}
                          </span>
                          {evt.roomId && (
                            <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border truncate max-w-[110px] ${
                              evt.roomId === 'auditorio'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`} title={evt.roomName || getRoomById(evt.roomId)?.label}>
                              {getRoomById(evt.roomId)?.code || 'Sala'}
                            </span>
                          )}
                        </div>

                        {/* Responsável e Modalidade */}
                        <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                          <span className="truncate flex items-center gap-1 text-slate-700 font-medium">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{therapistMap[evt.therapistId]?.split(' ')[0] || 'Equipe'}</span>
                          </span>
                          <span>
                            {evt.type === 'online' ? (
                              <Video className="w-3 h-3 text-blue-500" />
                            ) : (
                              <MapPin className="w-3 h-3 text-emerald-500" />
                            )}
                          </span>
                        </div>

                        {/* Sinalização de Contato para Notificação */}
                        {evt.clientWhatsApp && (
                          <div className="text-[9px] text-emerald-700 bg-emerald-50/80 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium">
                            <MessageCircle className="w-2.5 h-2.5 text-emerald-600" />
                            WhatsApp cadastrado
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Botão de Adicionar para o Dia */}
                    {onAddEventAtDate && (
                      <button
                        onClick={() => onAddEventAtDate(col.isoDate)}
                        className="w-full py-2 border border-dashed border-slate-200 rounded-lg text-[10px] font-medium text-slate-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Agendar neste dia
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
