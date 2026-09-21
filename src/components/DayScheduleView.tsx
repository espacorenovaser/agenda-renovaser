import React from 'react';
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus, 
  MapPin, 
  Video, 
  User, 
  Phone,
  MessageCircle
} from 'lucide-react';
import type { Evento, TherapistUser } from '../types';

interface DayScheduleViewProps {
  events: Evento[];
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (newDate: string) => void;
  onSelectEvent: (event: Evento) => void;
  onAddEventAtHour?: (date: string, hourStr: string) => void;
  therapists: TherapistUser[];
}

export function DayScheduleView({
  events,
  selectedDate,
  onDateChange,
  onSelectEvent,
  onAddEventAtHour,
  therapists
}: DayScheduleViewProps) {
  // Horários da Manhã: 07h às 12h
  const morningHours = [7, 8, 9, 10, 11, 12];
  // Horários da Tarde / Noite: 13h às 21h
  const afternoonHours = [13, 14, 15, 16, 17, 18, 19, 20, 21];

  const therapistMap = therapists.reduce<Record<string, string>>((acc, t) => {
    acc[t.id] = t.name;
    return acc;
  }, {});

  // Filtrar eventos do dia selecionado
  const dayEvents = events.filter((e) => e.date === selectedDate);

  // Extrai o horário inicial e final de uma string tipo "09:30 - 10:30" ou "14:00"
  const parseEventTimes = (timeStr: string) => {
    const parts = timeStr.split('-');
    const startStr = parts[0]?.trim() || '';
    const endStr = parts[1]?.trim() || '';

    const [startH, startM] = startStr.split(':').map((v) => parseInt(v, 10));
    const [endH, endM] = endStr ? endStr.split(':').map((v) => parseInt(v, 10)) : [NaN, NaN];

    return {
      startHour: isNaN(startH) ? null : startH,
      startMin: isNaN(startM) ? 0 : startM,
      endHour: isNaN(endH) ? null : endH,
      endMin: isNaN(endM) ? 0 : endM,
      rawStart: startStr,
      rawEnd: endStr
    };
  };

  // Navegação de dias
  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    const today = new Date().toISOString().split('T')[0];
    onDateChange(today);
  };

  // Formatação de data em português
  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Renderiza uma linha de hora individual
  const renderHourRow = (hour: number) => {
    const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
    
    // Eventos que começam nesta hora
    const startingEvents = dayEvents.filter((e) => {
      const { startHour } = parseEventTimes(e.time);
      return startHour === hour;
    });

    // Eventos que começaram antes mas ainda terminam ou passam por esta hora
    const continuingEvents = dayEvents.filter((e) => {
      const { startHour, endHour } = parseEventTimes(e.time);
      if (startHour === null || endHour === null) return false;
      return startHour < hour && endHour >= hour;
    });

    const hasEvents = startingEvents.length > 0 || continuingEvents.length > 0;

    return (
      <div 
        key={hour}
        className={`group border-b border-slate-200/80 transition-all flex min-h-[72px] ${
          hasEvents ? 'bg-white' : 'bg-slate-50/40 hover:bg-emerald-50/30 cursor-pointer'
        }`}
        onClick={() => {
          if (!hasEvents && onAddEventAtHour) {
            onAddEventAtHour(selectedDate, `${hour.toString().padStart(2, '0')}:00`);
          }
        }}
      >
        {/* Coluna do Marcador de Hora */}
        <div className="w-16 sm:w-20 shrink-0 border-r border-slate-200/80 p-2.5 flex flex-col justify-between text-right bg-slate-50/60 select-none">
          <span className="text-xs font-bold text-slate-700 font-mono tracking-tight">
            {hourLabel}
          </span>
          <span className="text-[10px] text-slate-400">
            {hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite'}
          </span>
        </div>

        {/* Conteúdo da Linha */}
        <div className="flex-1 p-2 space-y-1.5 flex flex-col justify-center">
          {/* Eventos que iniciam nesta hora */}
          {startingEvents.map((evt) => {
            const { rawStart, rawEnd, endHour } = parseEventTimes(evt.time);
            const extendsNextHour = endHour !== null && endHour > hour;

            return (
              <div
                key={evt.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEvent(evt);
                }}
                className="p-2.5 rounded-xl border border-slate-200 shadow-sm bg-white hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer space-y-1"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${evt.badgeColor}`}>
                      {evt.category.toUpperCase()}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 break-words leading-snug">
                      {evt.title}
                    </h4>
                  </div>
                  
                  {/* Badge de Horário Quebrado e Extensão */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono whitespace-nowrap">
                      <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                      {evt.time}
                    </span>
                    {extendsNextHour && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded whitespace-nowrap hidden sm:inline-block">
                        estende até {endHour}:00
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-0.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1 text-slate-700 font-medium">
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                      {therapistMap[evt.therapistId] || 'Equipe'}
                    </span>
                    <span className="flex items-center gap-1 text-slate-600">
                      {evt.type === 'online' ? (
                        <Video className="w-3 h-3 text-blue-500 shrink-0" />
                      ) : (
                        <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                      )}
                      {evt.location}
                    </span>
                  </div>

                  {/* Sinalização de WhatsApp/E-mail de notificação */}
                  {(evt.clientWhatsApp || evt.clientEmail) && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-medium">
                      {evt.clientWhatsApp && (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 whitespace-nowrap">
                          <MessageCircle className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                          {evt.clientWhatsApp}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Eventos contínuos da hora anterior */}
          {continuingEvents.map((evt) => (
            <div
              key={`cont-${evt.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEvent(evt);
              }}
              className="p-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-[11px] flex flex-wrap items-center justify-between gap-1.5 cursor-pointer transition-colors"
            >
              <span className="text-slate-700 flex items-center gap-1.5 break-words min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
                Continuação: <strong className="text-slate-900 font-semibold">{evt.title}</strong>
              </span>
              <span className="text-[10px] font-mono text-slate-500 shrink-0 whitespace-nowrap">
                (iniciou às {evt.time.split('-')[0]?.trim() || evt.time})
              </span>
            </div>
          ))}

          {/* Estado Vazio (Clique para agendar) */}
          {!hasEvents && (
            <div className="h-full flex items-center justify-between text-slate-400 text-xs px-2 py-1 opacity-60 group-hover:opacity-100 transition-opacity">
              <span className="text-[11px]">Horário livre</span>
              <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                <Plus className="w-3 h-3" /> Agendar neste horário
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Barra de Navegação do Dia */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevDay}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Dia anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={handleNextDay}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Próximo dia"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="ml-2">
            <h3 className="text-sm font-bold text-slate-900 capitalize">{formattedDate}</h3>
            <p className="text-[11px] text-slate-500">
              {dayEvents.length} compromisso(s) agendado(s) neste dia
            </p>
          </div>
        </div>

        {/* Input de Data */}
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Grid com 2 Colunas: Manhã (Esquerda) e Tarde (Direita) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Coluna da Esquerda: Manhã */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide uppercase flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              Manhã (07h às 12h)
            </span>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {morningHours.map((hour) => renderHourRow(hour))}
          </div>
        </div>

        {/* Coluna da Direita: Tarde / Noite */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide uppercase flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              Tarde & Noite (13h às 21h)
            </span>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {afternoonHours.map((hour) => renderHourRow(hour))}
          </div>
        </div>

      </div>
    </div>
  );
}
