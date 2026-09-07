import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Video,
  Clock,
  Users,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Search,
  CheckCircle2,
  Tag,
  GraduationCap,
  BookOpen,
  Wrench,
  Radio,
} from 'lucide-react';
import type { CalendarEvent, TimeSlot, ScheduleCategory } from '../types';
import { formatDateTimeBR, formatTimeBR, formatDateOnlyBR, SAO_PAULO_TZ } from '../lib/dateUtils';
import { classifyCalendarEvent, SCHEDULE_CATEGORIES, EVENT_SUBTYPES } from '../lib/scheduleTaxonomy';

interface CalendarViewProps {
  events: CalendarEvent[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectSlotForAssistant: (prompt: string) => void;
  onRequestCancel: (event: CalendarEvent) => void;
  isDemoMode?: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  isLoading,
  onRefresh,
  onSelectSlotForAssistant,
  onRequestCancel,
  isDemoMode,
}) => {
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow' | 'week'>('today');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ScheduleCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAvailability, setShowAvailability] = useState(false);
  const [showEventSubtypesModal, setShowEventSubtypesModal] = useState(false);

  // Filter events based on active tab, category, and search
  const filteredEvents = useMemo(() => {
    const now = new Date();
    // Get year, month, day in America/Sao_Paulo
    const getParts = (date: Date) => {
      const f = new Intl.DateTimeFormat('en-CA', {
        timeZone: SAO_PAULO_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return f.format(date); // YYYY-MM-DD
    };

    const todayStr = getParts(now);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = getParts(tomorrow);

    return events.filter((ev) => {
      if (!ev.start) return false;
      const evDateStr = ev.start.substring(0, 10);

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesAttendees = ev.attendees?.some((a) => a.toLowerCase().includes(q));
        if (!matchesTitle && !matchesAttendees) return false;
      }

      // Category match
      if (categoryFilter !== 'all') {
        const classified = classifyCalendarEvent(ev);
        if (classified.category !== categoryFilter) return false;
      }

      if (activeTab === 'today') {
        return evDateStr === todayStr;
      } else if (activeTab === 'tomorrow') {
        return evDateStr === tomorrowStr;
      } else {
        // next 7 days
        return true;
      }
    });
  }, [events, activeTab, categoryFilter, searchQuery]);

  // Compute Availability Slots (9:00 to 18:00) for the active day
  const availabilitySlots = useMemo<TimeSlot[]>(() => {
    const now = new Date();
    const targetDate = activeTab === 'tomorrow' ? new Date(now.getTime() + 24 * 3600 * 1000) : now;
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: SAO_PAULO_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = f.format(targetDate);

    const slots: TimeSlot[] = [];
    const dayEvents = events.filter((ev) => ev.start && ev.start.startsWith(dateStr));

    for (let hour = 9; hour < 18; hour++) {
      const hourStr = hour.toString().padStart(2, '0');
      const nextHourStr = (hour + 1).toString().padStart(2, '0');
      const slotStart = `${dateStr}T${hourStr}:00:00-03:00`;
      const slotEnd = `${dateStr}T${nextHourStr}:00:00-03:00`;

      const slotStartTime = new Date(slotStart).getTime();
      const slotEndTime = new Date(slotEnd).getTime();

      const conflict = dayEvents.find((ev) => {
        const evStart = new Date(ev.start).getTime();
        const evEnd = new Date(ev.end).getTime();
        return Math.max(slotStartTime, evStart) < Math.min(slotEndTime, evEnd);
      });

      slots.push({
        start: `${hourStr}:00`,
        end: `${nextHourStr}:00`,
        available: !conflict,
        conflictTitle: conflict ? conflict.title : undefined,
      });
    }

    return slots;
  }, [events, activeTab]);

  return (
    <div id="calendar-view-container" className="bg-white rounded-2xl border border-[#E2DFD4] shadow-xs flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#E2DFD4] bg-[#FAF9F5] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-[#EDEBE1] text-[#5C6B5A] flex items-center justify-center border border-[#DCD8CD]">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h2 className="text-sm font-semibold text-[#2E3029]">Agenda da Equipe</h2>
              {isDemoMode && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#E8EFE9] text-[#3D5A3F] border border-[#C2D6C0]">
                  Modo Demonstração
                </span>
              )}
            </div>
            <p className="text-xs text-[#76766D]">
              {isDemoMode
                ? 'Exibindo eventos de exemplo • Conecte Google Agenda para dados reais'
                : 'Sincronizado com Google Calendar'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="btn-toggle-availability"
            onClick={() => setShowAvailability(!showAvailability)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 border cursor-pointer ${
              showAvailability
                ? 'bg-[#5C6B5A] text-white border-[#5C6B5A] shadow-xs'
                : 'bg-white text-[#4A4A43] border-[#E2DFD4] hover:bg-[#FAF9F5]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{showAvailability ? 'Ocultar Horários Livres' : 'Consultar Disponibilidade'}</span>
          </button>

          <button
            id="btn-refresh-calendar"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-lg border border-[#E2DFD4] bg-white text-[#5C6B5A] hover:bg-[#FAF9F5] hover:text-[#2E3029] transition-colors disabled:opacity-50 cursor-pointer"
            title="Atualizar Agenda"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#5C6B5A]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Category Filter & Quick Actions */}
      <div className="px-4 py-2.5 border-b border-[#EDEBE1] bg-[#FAF9F5] flex flex-wrap items-center justify-between gap-2">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-medium text-[#76766D] mr-1 flex items-center space-x-1">
            <Tag className="w-3 h-3 text-[#8C9484]" />
            <span>Modalidade:</span>
          </span>
          <button
            id="filter-cat-all"
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs font-medium border ${
              categoryFilter === 'all'
                ? 'bg-[#5C6B5A] text-white border-[#5C6B5A] shadow-2xs'
                : 'bg-white text-[#4A4A43] border-[#E2DFD4] hover:bg-[#EDEBE1]'
            }`}
          >
            Todos
          </button>
          <button
            id="filter-cat-atendimento"
            onClick={() => setCategoryFilter('atendimento')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs font-medium border ${
              categoryFilter === 'atendimento'
                ? 'bg-[#3D5A3F] text-white border-[#3D5A3F] shadow-2xs'
                : 'bg-[#EBF0E9] text-[#3D5A3F] border-[#C2D6C0] hover:bg-[#DEE8DC]'
            }`}
          >
            Atendimentos (60-90 min)
          </button>
          <button
            id="filter-cat-reuniao"
            onClick={() => setCategoryFilter('reuniao')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs font-medium border ${
              categoryFilter === 'reuniao'
                ? 'bg-[#8C6D23] text-white border-[#8C6D23] shadow-2xs'
                : 'bg-[#FDF6E2] text-[#8C6D23] border-[#E8D9A8] hover:bg-[#F9EDCA]'
            }`}
          >
            Reuniões
          </button>
          <button
            id="filter-cat-evento"
            onClick={() => setCategoryFilter('evento')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs font-medium border ${
              categoryFilter === 'evento'
                ? 'bg-[#6B4B9A] text-white border-[#6B4B9A] shadow-2xs'
                : 'bg-[#F2EEFA] text-[#6B4B9A] border-[#D8CEEE] hover:bg-[#E7DFF5]'
            }`}
          >
            Eventos
          </button>
        </div>

        {/* Quick Schedule Triggers */}
        <div className="relative flex items-center space-x-1.5">
          <button
            id="quick-add-atendimento"
            onClick={() =>
              onSelectSlotForAssistant(
                'Gostaria de agendar um Atendimento com hora marcada (duração entre 60 e 90 minutos) na sala do instituto. Horário sugerido: amanhã às 14:00 (duração: 60 minutos).'
              )
            }
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-[#3D5A3F] border border-[#C2D6C0] hover:bg-[#EBF0E9] transition-colors cursor-pointer shadow-2xs"
            title="Agendar Atendimento de 60 a 90 min"
          >
            + Atendimento (60-90m)
          </button>

          <button
            id="quick-add-reuniao"
            onClick={() =>
              onSelectSlotForAssistant(
                'Gostaria de agendar uma Reunião com tempo definido conforme a necessidade. Horário sugerido: amanhã às 10:00 (duração: 45 minutos).'
              )
            }
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-[#8C6D23] border border-[#E8D9A8] hover:bg-[#FDF6E2] transition-colors cursor-pointer shadow-2xs"
            title="Agendar Reunião com tempo flexível"
          >
            + Reunião
          </button>

          <button
            id="quick-add-evento"
            onClick={() => setShowEventSubtypesModal(!showEventSubtypesModal)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-[#6B4B9A] border border-[#D8CEEE] hover:bg-[#F2EEFA] transition-colors cursor-pointer shadow-2xs flex items-center space-x-1"
            title="Agendar Evento: Workshop, Treinamento, Formação ou Transmissão on-line"
          >
            <span>+ Evento</span>
            <span className="text-[10px] opacity-70">▾</span>
          </button>

          {/* Subtypes Popover */}
          {showEventSubtypesModal && (
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-lg border border-[#D8CEEE] p-2 z-20 animate-in fade-in zoom-in-95 duration-100">
              <div className="text-[11px] font-semibold text-[#6B4B9A] px-2 py-1 border-b border-[#F2EEFA] mb-1">
                Escolha o tipo de evento:
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEventSubtypesModal(false);
                  onSelectSlotForAssistant(
                    'Gostaria de agendar um Evento do tipo Workshop no Instituto RenovaSer. Data e horário sugeridos: próxima sexta-feira das 14:00 às 17:00.'
                  );
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[#2E3029] hover:bg-[#F2EEFA] hover:text-[#6B4B9A] transition-colors flex items-start space-x-2 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5 text-[#6B4B9A] shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Workshop</div>
                  <div className="text-[10px] text-[#76766D]">Oficina prática e vivencial</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowEventSubtypesModal(false);
                  onSelectSlotForAssistant(
                    'Gostaria de agendar um Evento do tipo Treinamento no Instituto RenovaSer. Data e horário sugeridos: próximo sábado das 09:00 às 12:00.'
                  );
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[#2E3029] hover:bg-[#F2EEFA] hover:text-[#6B4B9A] transition-colors flex items-start space-x-2 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#6B4B9A] shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Treinamento</div>
                  <div className="text-[10px] text-[#76766D]">Capacitação prática e técnica</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowEventSubtypesModal(false);
                  onSelectSlotForAssistant(
                    'Gostaria de agendar um Evento do tipo Formação no Instituto RenovaSer. Data e horário sugeridos: próximo sábado das 09:00 às 18:00.'
                  );
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[#2E3029] hover:bg-[#F2EEFA] hover:text-[#6B4B9A] transition-colors flex items-start space-x-2 cursor-pointer"
              >
                <GraduationCap className="w-3.5 h-3.5 text-[#6B4B9A] shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Formação</div>
                  <div className="text-[10px] text-[#76766D]">Cursos teóricos e metodológicos</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowEventSubtypesModal(false);
                  onSelectSlotForAssistant(
                    'Gostaria de agendar um Evento do tipo Transmissão on-line com link do Google Meet no Instituto RenovaSer. Horário sugerido: próxima quinta-feira às 19:30.'
                  );
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[#2E3029] hover:bg-[#F2EEFA] hover:text-[#6B4B9A] transition-colors flex items-start space-x-2 cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5 text-[#6B4B9A] shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Transmissão on-line</div>
                  <div className="text-[10px] text-[#76766D]">Live, webinar remoto (Google Meet)</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="px-4 py-3 border-b border-[#EDEBE1] flex flex-wrap items-center justify-between gap-2 bg-white">
        <div className="flex space-x-1 bg-[#EDEBE1] p-1 rounded-xl text-xs font-medium">
          <button
            id="tab-today"
            onClick={() => setActiveTab('today')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'today' ? 'bg-white text-[#2E3029] shadow-xs' : 'text-[#76766D] hover:text-[#2E3029]'
            }`}
          >
            Hoje
          </button>
          <button
            id="tab-tomorrow"
            onClick={() => setActiveTab('tomorrow')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'tomorrow' ? 'bg-white text-[#2E3029] shadow-xs' : 'text-[#76766D] hover:text-[#2E3029]'
            }`}
          >
            Amanhã
          </button>
          <button
            id="tab-week"
            onClick={() => setActiveTab('week')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'week' ? 'bg-white text-[#2E3029] shadow-xs' : 'text-[#76766D] hover:text-[#2E3029]'
            }`}
          >
            Próximos 7 Dias
          </button>
        </div>

        <div className="relative flex-1 max-w-[200px]">
          <Search className="w-3.5 h-3.5 text-[#8C8C80] absolute left-2.5 top-2.5" />
          <input
            id="input-calendar-search"
            type="text"
            placeholder="Filtrar eventos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-[#E2DFD4] bg-[#FAF9F5] text-[#2E3029] focus:bg-white focus:outline-none focus:border-[#5C6B5A] placeholder:text-[#8C8C80]"
          />
        </div>
      </div>

      {/* Availability Inspector (Expandable) */}
      {showAvailability && (
        <div className="p-4 bg-[#F2F5F0] border-b border-[#D8E2D5] animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#2E3029] flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#5C6B5A]" />
              <span>
                Disponibilidade (09:00 - 18:00) — {activeTab === 'tomorrow' ? 'Amanhã' : 'Hoje'}
              </span>
            </span>
            <span className="text-[11px] text-[#5C6B5A]">Clique em um horário para agendar</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {availabilitySlots.map((slot, i) => (
              <button
                key={i}
                disabled={!slot.available}
                onClick={() =>
                  onSelectSlotForAssistant(
                    `Agendar reunião ${activeTab === 'tomorrow' ? 'amanhã' : 'hoje'} das ${slot.start} às ${
                      slot.end
                    }`
                  )
                }
                className={`p-2 rounded-lg text-center text-xs font-mono transition-all border ${
                  slot.available
                    ? 'bg-[#E8EFE9] text-[#3D5A3F] border-[#C2D6C0] hover:bg-[#DFEBE0] hover:border-[#ADC7AB] shadow-2xs cursor-pointer'
                    : 'bg-[#EDEBE1] text-[#8C8C80] border-[#E2DFD4] cursor-not-allowed line-through'
                }`}
                title={slot.available ? 'Horário livre' : `Ocupado: ${slot.conflictTitle}`}
              >
                <div className="font-semibold">{slot.start}</div>
                <div className="text-[10px] opacity-75">{slot.available ? 'Livre' : 'Ocupado'}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
        {isLoading && events.length === 0 ? (
          <div className="py-12 text-center text-[#76766D] text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#5C6B5A]" />
            <p>Carregando compromissos da agenda...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-[#76766D]">
            <div className="w-12 h-12 rounded-2xl bg-[#EDEBE1] text-[#5C6B5A] flex items-center justify-center mx-auto mb-3 border border-[#DCD8CD]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="font-medium text-[#2E3029] text-sm">Nenhum compromisso encontrado</p>
            <p className="text-xs text-[#76766D] mt-1 max-w-xs mx-auto">
              {searchQuery
                ? 'Nenhum evento corresponde ao filtro de busca.'
                : 'Sua agenda está livre neste período! Use o assistente para agendar novas reuniões.'}
            </p>
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const hasMeet = !!ev.meetLink;
            const classified = classifyCalendarEvent(ev);

            return (
              <div
                key={ev.id}
                className="group p-3.5 rounded-xl border border-[#E2DFD4] hover:border-[#8C9484] hover:shadow-xs bg-white hover:bg-[#FAF9F5]/50 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Classification Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${classified.badgeClass}`}
                      >
                        {classified.eventSubtype === 'workshop' && <Wrench className="w-3 h-3 text-[#6B4B9A]" />}
                        {classified.eventSubtype === 'treinamento' && <BookOpen className="w-3 h-3 text-[#6B4B9A]" />}
                        {classified.eventSubtype === 'formacao' && <GraduationCap className="w-3 h-3 text-[#6B4B9A]" />}
                        {classified.eventSubtype === 'transmissao_online' && <Radio className="w-3 h-3 text-[#6B4B9A]" />}
                        <span>{classified.label}</span>
                      </span>

                      <span className="text-[11px] text-[#76766D] bg-[#FAF9F5] px-1.5 py-0.5 rounded border border-[#EDEBE1]">
                        {classified.durationLabel}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-[#5C6B5A]" />
                      <h4 className="font-medium text-[#2E3029] text-sm truncate">{ev.title}</h4>
                    </div>

                    <div className="flex items-center space-x-2 mt-1 text-xs text-[#76766D]">
                      <Clock className="w-3.5 h-3.5 text-[#8C9484] shrink-0" />
                      <span>
                        {formatDateTimeBR(ev.start)} – {formatTimeBR(ev.end)}
                      </span>
                    </div>

                    {ev.attendees && ev.attendees.length > 0 && (
                      <div className="flex items-center space-x-1.5 mt-2 text-xs text-[#76766D]">
                        <Users className="w-3.5 h-3.5 text-[#8C9484] shrink-0" />
                        <span className="truncate">
                          {ev.attendees.length} participante(s): {ev.attendees.slice(0, 2).join(', ')}
                          {ev.attendees.length > 2 ? ` +${ev.attendees.length - 2}` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions & Meet Link */}
                  <div className="flex flex-col items-end space-y-2 shrink-0">
                    {hasMeet && (
                      <a
                        href={ev.meetLink!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#EBF0E9] text-[#4F6F52] hover:bg-[#DEE8DC] text-xs font-medium border border-[#C5D8C3] transition-colors"
                      >
                        <Video className="w-3.5 h-3.5 text-[#4F6F52]" />
                        <span>Google Meet</span>
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>
                    )}

                    <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() =>
                          onSelectSlotForAssistant(
                            `Reagendar ou atualizar a reunião "${ev.title}" (ID: ${ev.id})`
                          )
                        }
                        className="text-[11px] text-[#5C6B5A] hover:text-[#3D473B] hover:underline px-1.5 py-0.5 cursor-pointer font-medium"
                      >
                        Reagendar
                      </button>
                      <span className="text-[#DCD8CD]">|</span>
                      <button
                        onClick={() => onRequestCancel(ev)}
                        className="text-[11px] text-[#A25852] hover:text-[#803F3A] hover:underline px-1.5 py-0.5 cursor-pointer font-medium"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
