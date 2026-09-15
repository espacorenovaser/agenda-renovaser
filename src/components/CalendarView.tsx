import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Video,
  Clock,
  Users,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Search,
  CheckCircle2,
  Tag,
  GraduationCap,
  BookOpen,
  Wrench,
  Radio,
  X,
  UserCheck,
  Check,
  MessageSquare,
} from 'lucide-react';
import type { CalendarEvent, TimeSlot, ScheduleCategory, AppUser } from '../types';
import {
  formatDateTimeBR,
  formatTimeBR,
  formatDayHeaderBR,
  getMonthYearBR,
  SAO_PAULO_TZ,
} from '../lib/dateUtils';
import { classifyCalendarEvent } from '../lib/scheduleTaxonomy';
import { ProfessionalsMenu } from './ProfessionalsMenu';

interface CalendarViewProps {
  events: CalendarEvent[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectSlotForAssistant: (prompt: string) => void;
  onRequestCancel: (event: CalendarEvent) => void;
  isDemoMode?: boolean;
  selectedProfessionalEmail?: string | 'all';
  onSelectProfessional?: (user: AppUser | null) => void;
  onOpenChat?: () => void;
  activeUser?: AppUser | null;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  isLoading,
  onRefresh,
  onSelectSlotForAssistant,
  onRequestCancel,
  isDemoMode,
  selectedProfessionalEmail = 'all',
  onSelectProfessional,
  onOpenChat,
  activeUser,
}) => {
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow' | 'week' | 'month'>('today');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ScheduleCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAvailability, setShowAvailability] = useState(false);
  const [showEventSubtypesModal, setShowEventSubtypesModal] = useState(false);
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());

  // Helper to extract YYYY-MM-DD in SP timezone
  const getSaoPauloDateStr = (date: Date) => {
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: SAO_PAULO_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return f.format(date); // YYYY-MM-DD
  };

  // Helper to extract YYYY-MM in SP timezone
  const getSaoPauloYearMonthStr = (date: Date) => {
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: SAO_PAULO_TZ,
      year: 'numeric',
      month: '2-digit',
    });
    return f.format(date); // YYYY-MM
  };

  const todayStr = useMemo(() => getSaoPauloDateStr(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const now = new Date();
    const tom = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return getSaoPauloDateStr(tom);
  }, []);

  // Filter events based on: Professional, Tab (today, tomorrow, week, month), Category, and Search
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in7DaysStr = getSaoPauloDateStr(in7Days);
    const targetYearMonth = getSaoPauloYearMonthStr(currentMonthDate);

    return events.filter((ev) => {
      if (!ev.start) return false;
      const evDateStr = ev.start.substring(0, 10);
      const evYearMonth = ev.start.substring(0, 7);

      // 1. Filter by Selected Professional if not 'all'
      if (selectedProfessionalEmail && selectedProfessionalEmail !== 'all') {
        const emailLower = selectedProfessionalEmail.toLowerCase();
        const inAttendees = ev.attendees?.some((a) => a.toLowerCase().includes(emailLower));
        const inOwner =
          (ev as any).professionalEmail?.toLowerCase() === emailLower ||
          (ev as any).professionalName?.toLowerCase().includes(emailLower);
        const inDesc = ev.description?.toLowerCase().includes(emailLower);
        const inTitle = ev.title?.toLowerCase().includes(emailLower);

        // If it's a general institutional event, keep it visible or match specific professional
        if (!inAttendees && !inOwner && !inDesc && !inTitle && !ev.isInstitutionalEvent) {
          return false;
        }
      }

      // 2. Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title?.toLowerCase().includes(q);
        const matchesAttendees = ev.attendees?.some((a) => a.toLowerCase().includes(q));
        const matchesDesc = ev.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesAttendees && !matchesDesc) return false;
      }

      // 3. Category match
      if (categoryFilter !== 'all') {
        const classified = classifyCalendarEvent(ev);
        if (classified.category !== categoryFilter) return false;
      }

      // 4. Tab time boundary
      if (activeTab === 'today') {
        return evDateStr === todayStr;
      } else if (activeTab === 'tomorrow') {
        return evDateStr === tomorrowStr;
      } else if (activeTab === 'week') {
        // From today up to 7 days ahead
        return evDateStr >= todayStr && evDateStr <= in7DaysStr;
      } else if (activeTab === 'month') {
        // Matches the active viewing month (YYYY-MM)
        return evYearMonth === targetYearMonth;
      }

      return true;
    });
  }, [
    events,
    activeTab,
    categoryFilter,
    searchQuery,
    selectedProfessionalEmail,
    todayStr,
    tomorrowStr,
    currentMonthDate,
  ]);

  // Group events by day for 'week' and 'month' tabs
  const groupedEvents = useMemo(() => {
    if (activeTab !== 'week' && activeTab !== 'month') return null;

    const groups: { [dateStr: string]: CalendarEvent[] } = {};
    // Sort events chronologically
    const sorted = [...filteredEvents].sort((a, b) => {
      const timeA = new Date(a.start).getTime();
      const timeB = new Date(b.start).getTime();
      return timeA - timeB;
    });

    for (const ev of sorted) {
      const dateStr = ev.start.substring(0, 10);
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(ev);
    }

    return Object.entries(groups).map(([dateStr, items]) => ({
      dateStr,
      items,
    }));
  }, [filteredEvents, activeTab]);

  // Compute count of events for each tab for badges
  const tabCounts = useMemo(() => {
    const counts = { today: 0, tomorrow: 0, week: 0, month: 0 };
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in7DaysStr = getSaoPauloDateStr(in7Days);
    const targetYearMonth = getSaoPauloYearMonthStr(currentMonthDate);

    for (const ev of events) {
      if (!ev.start) continue;
      const evDateStr = ev.start.substring(0, 10);
      const evYearMonth = ev.start.substring(0, 7);

      // Respect professional filter if set
      if (selectedProfessionalEmail && selectedProfessionalEmail !== 'all') {
        const emailLower = selectedProfessionalEmail.toLowerCase();
        const inAttendees = ev.attendees?.some((a) => a.toLowerCase().includes(emailLower));
        const inOwner =
          (ev as any).professionalEmail?.toLowerCase() === emailLower ||
          (ev as any).professionalName?.toLowerCase().includes(emailLower);
        const inDesc = ev.description?.toLowerCase().includes(emailLower);
        if (!inAttendees && !inOwner && !inDesc && !ev.isInstitutionalEvent) {
          continue;
        }
      }

      if (evDateStr === todayStr) counts.today++;
      if (evDateStr === tomorrowStr) counts.tomorrow++;
      if (evDateStr >= todayStr && evDateStr <= in7DaysStr) counts.week++;
      if (evYearMonth === targetYearMonth) counts.month++;
    }

    return counts;
  }, [events, selectedProfessionalEmail, todayStr, tomorrowStr, currentMonthDate]);

  // Compute Availability Slots (9:00 to 18:00) for the active day
  const availabilitySlots = useMemo<TimeSlot[]>(() => {
    const now = new Date();
    const targetDate = activeTab === 'tomorrow' ? new Date(now.getTime() + 24 * 3600 * 1000) : now;
    const dateStr = getSaoPauloDateStr(targetDate);

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

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentMonthDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonthDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const handleCurrentMonth = () => {
    setCurrentMonthDate(new Date());
  };

  return (
    <div
      id="calendar-view-container"
      className="bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col h-full overflow-hidden"
    >
      {/* Top Header Bar: Title, Professional Menu, Chat Trigger & Refresh */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Agenda de Atendimentos
              </h2>
              {isDemoMode && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Modo Demonstração
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === 'today' && 'Visualizando agendamentos de Hoje na sala do instituto'}
              {activeTab === 'tomorrow' && 'Visualizando agendamentos de Amanhã na sala do instituto'}
              {activeTab === 'week' && 'Visualizando os próximos 7 dias de atendimentos'}
              {activeTab === 'month' &&
                `Visualizando agendamentos do mês de ${getMonthYearBR(currentMonthDate)}`}
            </p>
          </div>
        </div>

        {/* Right side controls: Professional Menu, Availability Toggle, Refresh */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Menu de Profissionais */}
          {onSelectProfessional && (
            <ProfessionalsMenu
              selectedProfessionalEmail={selectedProfessionalEmail}
              onSelectProfessional={onSelectProfessional}
              events={events}
              activeUser={activeUser || null}
            />
          )}

          {/* Availability Toggle */}
          <button
            id="btn-toggle-availability"
            onClick={() => setShowAvailability(!showAvailability)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1.5 border cursor-pointer ${
              showAvailability
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title="Consultar horários livres para atendimento hoje/amanhã"
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {showAvailability ? 'Ocultar Livres' : 'Horários Livres'}
            </span>
          </button>

          {/* Refresh Button */}
          <button
            id="btn-refresh-calendar"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Atualizar Agenda"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-700' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Professional Filter Banner (if filtering by a specific professional) */}
      {selectedProfessionalEmail !== 'all' && (
        <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-emerald-700" />
            <span>
              Filtrado por: <strong className="text-emerald-950">{selectedProfessionalEmail}</strong>
            </span>
            <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono font-bold">
              {filteredEvents.length} compromisso(s)
            </span>
          </div>
          {onSelectProfessional && (
            <button
              type="button"
              onClick={() => onSelectProfessional(null)}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center space-x-1 underline cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Ver todos os profissionais</span>
            </button>
          )}
        </div>
      )}

      {/* Category Pills & Quick Scheduling Buttons */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center space-x-1">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <span>Modalidade:</span>
          </span>
          <button
            id="filter-cat-all"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-semibold border ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todos
          </button>
          <button
            id="filter-cat-atendimento"
            onClick={() => setCategoryFilter('atendimento')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-semibold border ${
              categoryFilter === 'atendimento'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Atendimento
          </button>
          <button
            id="filter-cat-reuniao"
            onClick={() => setCategoryFilter('reuniao')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-semibold border ${
              categoryFilter === 'reuniao'
                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
            }`}
          >
            Reuniões
          </button>
          <button
            id="filter-cat-evento"
            onClick={() => setCategoryFilter('evento')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-semibold border ${
              categoryFilter === 'evento'
                ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                : 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
            }`}
          >
            Eventos
          </button>
          <button
            id="filter-cat-comunicacao"
            onClick={() => setCategoryFilter('comunicacao')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs font-semibold border ${
              categoryFilter === 'comunicacao'
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                : 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
            }`}
          >
            Comunicações
          </button>
        </div>

        {/* Action Buttons: Registrar Horário na frente à esquerda dos botões + Quick Schedule Triggers */}
        <div className="relative flex flex-wrap items-center gap-2">
          {/* Botão Principal: Registrar Horário na Agenda (Abre o Chat do Assistente) */}
          <button
            id="btn-open-register-chat"
            type="button"
            onClick={() => {
              if (onOpenChat) {
                onOpenChat();
              } else {
                onSelectSlotForAssistant(
                  'Olá! Gostaria de registrar um novo horário na agenda do Instituto RenovaSer.'
                );
              }
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs hover:shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer border border-emerald-800"
            title="Abrir o assistente inteligente para registrar um novo atendimento, reunião ou evento"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
            <span>+ Registrar Horário</span>
          </button>

          <button
            id="quick-add-atendimento"
            onClick={() => {
              onSelectSlotForAssistant(
                'Gostaria de agendar um Atendimento com hora marcada (duração entre 60 e 90 minutos) na sala do instituto. Horário sugerido: amanhã às 14:00 (duração: 60 minutos).'
              );
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors cursor-pointer shadow-2xs"
            title="Agendar Atendimento"
          >
            + Atendimento
          </button>

          <button
            id="quick-add-reuniao"
            onClick={() => {
              onSelectSlotForAssistant(
                'Gostaria de agendar uma Reunião com tempo definido conforme a necessidade. Horário sugerido: amanhã às 10:00 (duração: 45 minutos).'
              );
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-amber-800 border border-amber-200 hover:bg-amber-50 transition-colors cursor-pointer shadow-2xs"
            title="Agendar Reunião com tempo flexível"
          >
            + Reunião
          </button>

          <button
            id="quick-add-evento"
            onClick={() => setShowEventSubtypesModal(!showEventSubtypesModal)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 transition-colors cursor-pointer shadow-2xs flex items-center space-x-1"
            title="Agendar Evento: Workshop, Treinamento, Formação ou Transmissão on-line"
          >
            <span>+ Evento</span>
            <span className="text-[10px] opacity-70">▾</span>
          </button>

          {/* Novo Botão: + Comunicação */}
          <button
            id="quick-add-comunicacao"
            onClick={() => {
              onSelectSlotForAssistant(
                'Gostaria de registrar uma Comunicação oficial para a equipe do Instituto RenovaSer.'
              );
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer shadow-2xs flex items-center space-x-1"
            title="Registrar Comunicação ou informativo oficial"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
            <span>+ Comunicação</span>
          </button>

          {/* Subtypes Popover */}
          {showEventSubtypesModal && (
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-purple-200 p-2 z-20 animate-in fade-in zoom-in-95 duration-100">
              <div className="text-[11px] font-bold text-purple-800 px-2 py-1 border-b border-purple-100 mb-1">
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
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-800 hover:bg-purple-50 hover:text-purple-900 transition-colors flex items-start space-x-2 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Workshop</div>
                  <div className="text-[10px] text-slate-500">Oficina prática e vivencial</div>
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
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-800 hover:bg-purple-50 hover:text-purple-900 transition-colors flex items-start space-x-2 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Treinamento</div>
                  <div className="text-[10px] text-slate-500">Capacitação prática e técnica</div>
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
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-800 hover:bg-purple-50 hover:text-purple-900 transition-colors flex items-start space-x-2 cursor-pointer"
              >
                <GraduationCap className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Formação</div>
                  <div className="text-[10px] text-slate-500">Cursos teóricos e metodológicos</div>
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
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-800 hover:bg-purple-50 hover:text-purple-900 transition-colors flex items-start space-x-2 cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Transmissão on-line</div>
                  <div className="text-[10px] text-slate-500">Live remota com Google Meet</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation Segmented Control: Hoje | Amanhã | Semana | Mês + Search Bar */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
        {/* Navigation Segmented Control (Clean, Modern, High-Contrast) */}
        <div className="flex space-x-1 bg-slate-100 p-1.5 rounded-xl text-xs font-semibold">
          <button
            id="tab-today"
            onClick={() => setActiveTab('today')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'today'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Hoje</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'today'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {tabCounts.today}
            </span>
          </button>

          <button
            id="tab-tomorrow"
            onClick={() => setActiveTab('tomorrow')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'tomorrow'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Amanhã</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'tomorrow'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {tabCounts.tomorrow}
            </span>
          </button>

          <button
            id="tab-week"
            onClick={() => setActiveTab('week')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'week'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Semana</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'week'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {tabCounts.week}
            </span>
          </button>

          <button
            id="tab-month"
            onClick={() => setActiveTab('month')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'month'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Mês</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'month'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {tabCounts.month}
            </span>
          </button>
        </div>

        {/* Month Navigator Controls (Shown when activeTab === 'month') */}
        {activeTab === 'month' && (
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-800 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer text-slate-600 hover:text-slate-900"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold px-2 capitalize text-slate-900">
              {getMonthYearBR(currentMonthDate)}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer text-slate-600 hover:text-slate-900"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCurrentMonth}
              className="ml-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-bold px-2 py-0.5 rounded hover:bg-emerald-50 cursor-pointer"
            >
              Mês Atual
            </button>
          </div>
        )}

        {/* Search Input */}
        <div className="relative flex-1 max-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="input-calendar-search"
            type="text"
            placeholder="Filtrar eventos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder:text-slate-400 transition-colors"
          />
        </div>
      </div>

      {/* Availability Inspector (Clean, prominent cards with high contrast) */}
      {showAvailability && (
        <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span className="text-xs font-bold text-slate-900">
                Disponibilidade de Horários (09:00 - 18:00) — {activeTab === 'tomorrow' ? 'Amanhã' : 'Hoje'}
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              Clique em um horário livre para agendar com o assistente
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2.5">
            {availabilitySlots.map((slot, i) => (
              <button
                key={i}
                disabled={!slot.available}
                onClick={() =>
                  onSelectSlotForAssistant(
                    `Agendar atendimento com hora marcada ${
                      activeTab === 'tomorrow' ? 'amanhã' : 'hoje'
                    } das ${slot.start} às ${slot.end} (duração: 60 minutos) na sala do Instituto RenovaSer.`
                  )
                }
                className={`p-3 rounded-xl text-center text-xs transition-all border ${
                  slot.available
                    ? 'bg-white border-2 border-emerald-400 hover:border-emerald-600 hover:bg-emerald-50/50 shadow-xs hover:shadow-sm cursor-pointer group'
                    : 'bg-slate-100/80 border border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                }`}
                title={slot.available ? 'Horário livre - Clique para agendar' : `Ocupado: ${slot.conflictTitle}`}
              >
                <div
                  className={`font-bold text-sm ${
                    slot.available ? 'text-slate-900 group-hover:text-emerald-800' : 'text-slate-400'
                  }`}
                >
                  {slot.start}
                </div>
                <div className="mt-1.5 flex justify-center">
                  {slot.available ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                      <span>Livre</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/80 text-slate-500">
                      Ocupado
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Events View Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-white">
        {isLoading && events.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-700" />
            <p className="font-bold text-slate-900 text-base">Sincronizando com Google Calendar...</p>
            <p className="text-xs text-slate-500 mt-1">
              Buscando atendimentos e disponibilidade da sala
            </p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3 border border-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="font-bold text-slate-900 text-base">Nenhum compromisso encontrado</p>
            <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
              {searchQuery
                ? 'Nenhum evento corresponde ao filtro de busca atual.'
                : selectedProfessionalEmail !== 'all'
                ? `A agenda deste profissional está livre para ${
                    activeTab === 'today'
                      ? 'hoje'
                      : activeTab === 'tomorrow'
                      ? 'amanhã'
                      : activeTab === 'week'
                      ? 'esta semana'
                      : 'este mês'
                  }!`
                : `A sala está totalmente livre neste período (${
                    activeTab === 'today'
                      ? 'hoje'
                      : activeTab === 'tomorrow'
                      ? 'amanhã'
                      : activeTab === 'week'
                      ? 'esta semana'
                      : 'este mês'
                  }). Clique no botão abaixo para agendar.`}
            </p>

            <button
              type="button"
              onClick={() => {
                if (onOpenChat) onOpenChat();
                else {
                  onSelectSlotForAssistant(
                    `Gostaria de registrar um horário na agenda ${
                      activeTab === 'tomorrow' ? 'de amanhã' : 'de hoje'
                    } às 14:00 (duração: 60 minutos).`
                  );
                }
              }}
              className="mt-4 inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>Registrar Horário Agora</span>
            </button>
          </div>
        ) : groupedEvents ? (
          /* Grouped Events View (For 'week' and 'month' tabs) */
          <div className="space-y-6">
            {groupedEvents.map(({ dateStr, items }) => (
              <div key={dateStr} className="space-y-3">
                {/* Date header with clean badge */}
                <div className="flex items-center space-x-3 pb-2 border-b border-slate-100">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 capitalize">
                    {formatDayHeaderBR(dateStr)}
                  </h3>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold border border-slate-200">
                    {items.length} {items.length === 1 ? 'compromisso' : 'compromissos'}
                  </span>
                </div>

                {/* Cards for that day */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {items.map((ev) => (
                    <EventCard
                      key={ev.id}
                      ev={ev}
                      onSelectSlotForAssistant={onSelectSlotForAssistant}
                      onRequestCancel={onRequestCancel}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Single Day List View (For 'today' and 'tomorrow' tabs) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredEvents.map((ev) => (
              <EventCard
                key={ev.id}
                ev={ev}
                onSelectSlotForAssistant={onSelectSlotForAssistant}
                onRequestCancel={onRequestCancel}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Extracted Subcomponent for cleaner code
interface EventCardProps {
  ev: CalendarEvent;
  onSelectSlotForAssistant: (prompt: string) => void;
  onRequestCancel: (event: CalendarEvent) => void;
}

const EventCard: React.FC<EventCardProps> = ({
  ev,
  onSelectSlotForAssistant,
  onRequestCancel,
}) => {
  const hasMeet = !!ev.meetLink;
  const classified = classifyCalendarEvent(ev);

  return (
    <div className="group p-4 sm:p-4.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md bg-white transition-all flex flex-col justify-between">
      <div>
        {/* Classification Badges */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5">
          <span
            className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${classified.badgeClass}`}
          >
            {classified.eventSubtype === 'workshop' && <Wrench className="w-3 h-3 text-purple-700" />}
            {classified.eventSubtype === 'treinamento' && <BookOpen className="w-3 h-3 text-purple-700" />}
            {classified.eventSubtype === 'formacao' && (
              <GraduationCap className="w-3 h-3 text-purple-700" />
            )}
            {classified.eventSubtype === 'transmissao_online' && (
              <Radio className="w-3 h-3 text-sky-700" />
            )}
            <span>{classified.label}</span>
          </span>

          <span className="text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-mono font-medium">
            {classified.durationLabel}
          </span>
        </div>

        {/* Title */}
        <div className="flex items-start space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-700 mt-1.5 shrink-0" />
          <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug break-words">
            {ev.title}
          </h4>
        </div>

        {/* Time and Location */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-xs text-slate-700">
          <div className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-100">
            <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="font-bold text-slate-900">
              {formatTimeBR(ev.start)} – {formatTimeBR(ev.end)}
            </span>
          </div>

          {ev.location && (
            <span className="text-slate-500 text-xs truncate">• {ev.location}</span>
          )}
        </div>

        {/* Description Snippet if available */}
        {ev.description && (
          <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
            {ev.description}
          </p>
        )}

        {/* Attendees / Professional */}
        {ev.attendees && ev.attendees.length > 0 && (
          <div className="flex items-center space-x-1.5 mt-2.5 text-xs text-slate-500">
            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {ev.attendees.length} participante(s): {ev.attendees.slice(0, 2).join(', ')}
              {ev.attendees.length > 2 ? ` +${ev.attendees.length - 2}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Footer Actions: Meet link, Google Calendar Link, Reagendar, Cancelar */}
      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          {hasMeet && (
            <a
              href={ev.meetLink!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold shadow-2xs transition-colors"
              title="Abrir sala do Google Meet"
            >
              <Video className="w-3.5 h-3.5 text-white" />
              <span>Meet</span>
              <ExternalLink className="w-3 h-3 opacity-75" />
            </a>
          )}

          {ev.htmlLink && (
            <a
              href={ev.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-900 font-medium hover:underline"
              title="Ver no Google Agenda"
            >
              <span>Google Agenda</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <button
            type="button"
            onClick={() =>
              onSelectSlotForAssistant(
                `Reagendar ou alterar o horário do compromisso "${ev.title}" (ID: ${ev.id}) marcado para ${formatDateTimeBR(
                  ev.start
                )}.`
              )
            }
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer transition-colors"
          >
            Reagendar
          </button>
          <button
            type="button"
            onClick={() => onRequestCancel(ev)}
            className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold cursor-pointer transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
