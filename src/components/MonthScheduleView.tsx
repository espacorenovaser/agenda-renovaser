import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Plus, 
  Calendar as CalendarIcon 
} from 'lucide-react';
import type { Evento, TherapistUser } from '../types';

interface MonthScheduleViewProps {
  events: Evento[];
  onSelectEvent: (event: Evento) => void;
  onAddEventAtDate?: (dateStr: string) => void;
  therapists: TherapistUser[];
}

export function MonthScheduleView({
  events,
  onSelectEvent,
  onAddEventAtDate,
  therapists
}: MonthScheduleViewProps) {
  const [currentYearMonth, setCurrentYearMonth] = useState(() => {
    const today = new Date();
    return {
      year: today.getFullYear(),
      month: today.getMonth() // 0 = Jan, 11 = Dez
    };
  });

  const therapistMap = therapists.reduce<Record<string, string>>((acc, t) => {
    acc[t.id] = t.name;
    return acc;
  }, {});

  // Mês formatado
  const dateObj = new Date(currentYearMonth.year, currentYearMonth.month, 1);
  const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Quantidade de dias no mês
  const daysInMonth = new Date(currentYearMonth.year, currentYearMonth.month + 1, 0).getDate();

  // Para garantir os 31 quadrados conforme o pedido do usuário
  // "Mês com os 31 quadrados quando tiver agendado no dia só sinaliza com a hora e clicando em cima abre as informações"
  const daySquares = Array.from({ length: 31 }).map((_, idx) => {
    const dayNumber = idx + 1;
    const isValidDay = dayNumber <= daysInMonth;
    const monthStr = (currentYearMonth.month + 1).toString().padStart(2, '0');
    const dayStr = dayNumber.toString().padStart(2, '0');
    const isoDate = `${currentYearMonth.year}-${monthStr}-${dayStr}`;

    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = isoDate === todayStr;

    const dayEvents = isValidDay ? events.filter((e) => e.date === isoDate) : [];
    dayEvents.sort((a, b) => a.time.localeCompare(b.time));

    return {
      dayNumber,
      isValidDay,
      isoDate,
      isToday,
      dayEvents
    };
  });

  const handlePrevMonth = () => {
    setCurrentYearMonth((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setCurrentYearMonth((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleCurrentMonth = () => {
    const today = new Date();
    setCurrentYearMonth({
      year: today.getFullYear(),
      month: today.getMonth()
    });
  };

  return (
    <div className="space-y-4">
      {/* Barra de Navegação do Mês */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleCurrentMonth}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            Mês Atual
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="ml-2">
            <h3 className="text-sm font-bold text-slate-900 capitalize">{monthName}</h3>
            <p className="text-[11px] text-slate-500">
              Visualização em 31 quadrados com sinalização de horários
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          Clique no horário ou no dia para abrir as informações completas
        </div>
      </div>

      {/* Grid com 31 Quadrados */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
        {daySquares.map((sq) => {
          if (!sq.isValidDay) {
            return (
              <div
                key={`empty-${sq.dayNumber}`}
                className="bg-slate-50/50 border border-dashed border-slate-200 rounded-xl p-3 min-h-[105px] opacity-40 flex flex-col justify-between"
              >
                <span className="text-xs font-bold text-slate-300">Dia {sq.dayNumber}</span>
                <span className="text-[10px] text-slate-300">Não aplicável</span>
              </div>
            );
          }

          const hasEvents = sq.dayEvents.length > 0;

          return (
            <div
              key={sq.isoDate}
              onClick={() => {
                if (hasEvents) {
                  onSelectEvent(sq.dayEvents[0]);
                } else if (onAddEventAtDate) {
                  onAddEventAtDate(sq.isoDate);
                }
              }}
              className={`rounded-xl p-2.5 border min-h-[105px] flex flex-col justify-between transition-all cursor-pointer group ${
                sq.isToday
                  ? 'bg-emerald-50/50 border-emerald-400 shadow-sm'
                  : hasEvents
                  ? 'bg-white border-slate-200 hover:border-emerald-400 hover:shadow-md'
                  : 'bg-white border-slate-200 hover:bg-slate-50/70 hover:border-slate-300'
              }`}
            >
              {/* Topo do Quadrado: Número do Dia */}
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${
                  sq.isToday ? 'text-emerald-700 font-extrabold' : 'text-slate-800'
                }`}>
                  {sq.dayNumber.toString().padStart(2, '0')}
                </span>
                {sq.isToday && (
                  <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                    Hoje
                  </span>
                )}
                {!hasEvents && (
                  <span className="text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                    +
                  </span>
                )}
              </div>

              {/* Sinalização dos Horários Agendados */}
              <div className="space-y-1 my-1 flex-1 overflow-hidden">
                {sq.dayEvents.slice(0, 3).map((evt) => {
                  const startTime = evt.time.split('-')[0]?.trim() || evt.time;

                  return (
                    <div
                      key={evt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(evt);
                      }}
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex items-center justify-between gap-1 border transition-transform hover:scale-[1.02] ${
                        evt.category === 'atendimento'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                          : evt.category === 'reuniao'
                          ? 'bg-blue-100 text-blue-900 border-blue-200'
                          : 'bg-purple-100 text-purple-900 border-purple-200'
                      }`}
                      title={`${evt.time} - ${evt.title} (${therapistMap[evt.therapistId] || 'Equipe'})`}
                    >
                      <span className="flex items-center gap-0.5 font-mono">
                        <Clock className="w-2.5 h-2.5 opacity-70" />
                        {startTime}
                      </span>
                      <span className="truncate text-[9px] font-normal opacity-80">
                        {evt.title}
                      </span>
                    </div>
                  );
                })}

                {sq.dayEvents.length > 3 && (
                  <div className="text-[9px] font-bold text-slate-500 text-center">
                    +{sq.dayEvents.length - 3} mais
                  </div>
                )}
              </div>

              {/* Rodapé do Quadrado */}
              <div className="text-[9px] text-slate-400 truncate">
                {hasEvents ? (
                  <span className="text-emerald-700 font-medium">
                    {sq.dayEvents.length} agendado{sq.dayEvents.length > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-slate-300 group-hover:text-slate-400">Livre</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
