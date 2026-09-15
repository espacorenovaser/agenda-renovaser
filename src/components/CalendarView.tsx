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
  AlertCircle,
  Sparkles,
  Search,
  CheckCircle2,
  Tag,
  GraduationCap,
  BookOpen,
  Wrench,
  Radio,
  CalendarPlus,
  MessageSquare,
  Filter,
  X,
  UserCheck,
} from 'lucide-react';
import type { CalendarEvent, TimeSlot, ScheduleCategory, AppUser } from '../types';
import {
  formatDateTimeBR,
  formatTimeBR,
  formatDateOnlyBR,
  formatDayHeaderBR,
  getMonthYearBR,
  SAO_PAULO_TZ,
} from '../lib/dateUtils';
import { classifyCalendarEvent, SCHEDULE_CATEGORIES, EVENT_SUBTYPES } from '../lib/scheduleTaxonomy';
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
      className="bg-white rounded-2xl border border-[#E2DFD4] shadow-xs flex flex-col h-full overflow-hidden"
    >
      {/* Top Header Bar: Title, Professional Menu, Chat Trigger & Refresh */}
      <div className="p-4 border-b border-[#E2DFD4] bg-[#FAF9F5] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#5C6B5A] text-white flex items-center justify-center shadow-xs">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-[#2E3029]">Agenda de Atendimentos</h2>
              {isDemoMode && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#E8EFE9] text-[#3D5A3F] border border-[#C2D6C0]">
                  Modo Demonstração
                </span>
              )}
            </div>
            <p className="text-xs text-[#76766D]">
              {activeTab === 'today' && 'Visualizando agendamentos de Hoje na sala do instituto'}
              {activeTab === 'tomorrow' && 'Visualizando agendamentos de Amanhã na sala do instituto'}
              {activeTab === 'week' && 'Visualizando os próximos 7 dias de atendimentos'}
              {activeTab === 'month' &&
                `Visualizando agendamentos do mês de ${getMonthYearBR(currentMonthDate)}`}
            </p>
          </div>
        </div>

        {/* Right side controls: Professional Menu + Button to Open Chat + Refresh */}
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
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#455243] hover:bg-[#384436] text-[#F7F5F0] shadow-xs hover:shadow-sm transition-all flex items-center space-x-2 cursor-pointer border border-[#384436]"
            title="Abrir o assistente inteligente para registrar um novo atendimento ou reunião"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C4D9C2]" />
            <span>+ Registrar Horário</span>
          </button>

          {/* Availability Toggle */}
          <button
            id="btn-toggle-availability"
            onClick={() => setShowAvailability(!showAvailability)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center space-x-1.5 border cursor-pointer ${
              showAvailability
                ? 'bg-[#5C6B5A] text-white border-[#5C6B5A] shadow-xs'
                : 'bg-white text-[#4A4A43] border-[#E2DFD4] hover:bg-[#FAF9F5]'
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
            className="p-2 rounded-xl border border-[#E2DFD4] bg-white text-[#5C6B5A] hover:bg-[#FAF9F5] hover:text-[#2E3029] transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Atualizar Agenda"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#5C6B5A]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Professional Filter Banner (if filtering by a specific professional) */}
      {selectedProfessionalEmail !== 'all' && (
        <div className="px-4 py-2 bg-[#EBF0E9] border-b border-[#C2D6C0] text-xs text-[#3D5A3F] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-[#3D5A3F]" />
            <span>
              Filtrado por: <strong>{selectedProfessionalEmail}</strong>
            </span>
            <span className="text-[11px] bg-[#D7E2D5] px-2 py-0.5 rounded-full font-mono font-medium">
              {filteredEvents.length} compromisso(s)
            </span>
          </div>
          {onSelectProfessional && (
            <button
              type="button"
              onClick={() => onSelectProfessional(null)}
              className="text-xs font-semibold text-[#3D5A3F] hover:text-[#283C29] flex items-center space-x-1 hover:underline cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Ver todos os profissionais</span>
            </button>
          )}
        </div>
      )}

      {/* Category Pills & Quick Scheduling Buttons */}
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

        {/* Quick Schedule Triggers (Also opens the assistant chat) */}
        <div className="relative flex items-center space-x-1.5">
          <button
            id="quick-add-atendimento"
            onClick={() => {
              onSelectSlotForAssistant(
                'Gostaria de agendar um Atendimento com hora marcada (duração entre 60 e 90 minutos) na sala do instituto. Horário sugerido: amanhã às 14:00 (duração: 60 minutos).'
              );
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-[#3D5A3F] border border-[#C2D6C0] hover:bg-[#EBF0E9] transition-colors cursor-pointer shadow-2xs"
            title="Agendar Atendimento de 60 a 90 min"
          >
            + Atendimento (60-90m)
          </button>

          <button
            id="quick-add-reuniao"
            onClick={() => {
              onSelectSlotForAssistant(
                'Gostaria de agendar uma Reunião com tempo definido conforme a necessidade. Horário sugerido: amanhã às 10:00 (duração: 45 minutos).'
              );
            }}
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
                  <div className="text-[10px] text-[#76766D]">Live remota com Google Meet</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Tabs: Hoje | Amanhã | Semana | Mês + Search Bar */}
      <div className="px-4 py-3 border-b border-[#EDEBE1] flex flex-wrap items-center justify-between gap-3 bg-white">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-[#EDEBE1] p-1 rounded-xl text-xs font-medium">
          <button
            id="tab-today"
            onClick={() => setActiveTab('today')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'today'
                ? 'bg-white text-[#2E3029] shadow-xs font-semibold'
                : 'text-[#76766D] hover:text-[#2E3029]'
            }`}
          >
            <span>Hoje</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'today'
                  ? 'bg-[#E8EFE9] text-[#3D5A3F]'
                  : 'bg-[#DCD8CD] text-[#76766D]'
              }`}
            >
              {tabCounts.today}
            </span>
          </button>

          <button
            id="tab-tomorrow"
            onClick={() => setActiveTab('tomorrow')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'tomorrow'
                ? 'bg-white text-[#2E3029] shadow-xs font-semibold'
                : 'text-[#76766D] hover:text-[#2E3029]'
            }`}
          >
            <span>Amanhã</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'tomorrow'
                  ? 'bg-[#E8EFE9] text-[#3D5A3F]'
                  : 'bg-[#DCD8CD] text-[#76766D]'
              }`}
            >
              {tabCounts.tomorrow}
            </span>
          </button>

          <button
            id="tab-week"
            onClick={() => setActiveTab('week')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'week'
                ? 'bg-white text-[#2E3029] shadow-xs font-semibold'
                : 'text-[#76766D] hover:text-[#2E3029]'
            }`}
          >
            <span>Semana</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'week'
                  ? 'bg-[#E8EFE9] text-[#3D5A3F]'
                  : 'bg-[#DCD8CD] text-[#76766D]'
              }`}
            >
              {tabCounts.week}
            </span>
          </button>

          <button
            id="tab-month"
            onClick={() => setActiveTab('month')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'month'
                ? 'bg-white text-[#2E3029] shadow-xs font-semibold'
                : 'text-[#76766D] hover:text-[#2E3029]'
            }`}
          >
            <span>Mês</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'month'
                  ? 'bg-[#E8EFE9] text-[#3D5A3F]'
                  : 'bg-[#DCD8CD] text-[#76766D]'
              }`}
            >
              {tabCounts.month}
            </span>
          </button>
        </div>

        {/* Month Navigator Controls (Shown when activeTab === 'month') */}
        {activeTab === 'month' && (
          <div className="flex items-center space-x-1 bg-[#FAF9F5] border border-[#E2DFD4] rounded-xl px-2 py-1 text-xs text-[#2E3029]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-[#EDEBE1] rounded-lg transition-colors cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4 text-[#5C6B5A]" />
            </button>
            <span className="font-semibold px-2 capitalize">
              {getMonthYearBR(currentMonthDate)}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-[#EDEBE1] rounded-lg transition-colors cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4 text-[#5C6B5A]" />
            </button>
            <button
              type="button"
              onClick={handleCurrentMonth}
              className="ml-1 text-[11px] text-[#5C6B5A] hover:underline font-medium px-1.5 py-0.5 rounded hover:bg-[#E8EFE9] cursor-pointer"
            >
              Mês Atual
            </button>
          </div>
        )}

        {/* Search Input */}
        <div className="relative flex-1 max-w-[220px]">
          <Search className="w-3.5 h-3.5 text-[#8C8C80] absolute left-2.5 top-2.5" />
          <input
            id="input-calendar-search"
            type="text"
            placeholder="Filtrar eventos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-[#E2DFD4] bg-[#FAF9F5] text-[#2E3029] focus:bg-white focus:outline-none focus:border-[#5C6B5A] placeholder:text-[#8C8C80]"
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
            <span className="text-[11px] text-[#5C6B5A]">Clique em um horário para registrar</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
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
                className={`p-2 rounded-lg text-center text-xs font-mono transition-all border ${
                  slot.available
                    ? 'bg-[#E8EFE9] text-[#3D5A3F] border-[#C2D6C0] hover:bg-[#DFEBE0] hover:border-[#ADC7AB] shadow-2xs cursor-pointer'
                    : 'bg-[#EDEBE1] text-[#8C8C80] border-[#E2DFD4] cursor-not-allowed line-through'
                }`}
                title={slot.available ? 'Horário livre - Clique para agendar' : `Ocupado: ${slot.conflictTitle}`}
              >
                <div className="font-semibold">{slot.start}</div>
                <div className="text-[10px] opacity-75">{slot.available ? 'Livre' : 'Ocupado'}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Events View Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-white">
        {isLoading && events.length === 0 ? (
          <div className="py-16 text-center text-[#76766D] text-sm">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-[#5C6B5A]" />
            <p className="font-medium text-[#2E3029]">Sincronizando com Google Calendar...</p>
            <p className="text-xs text-[#76766D] mt-1">
              Buscando atendimentos e disponibilidade da sala
            </p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-16 text-center text-[#76766D]">
            <div className="w-14 h-14 rounded-2xl bg-[#EDEBE1] text-[#5C6B5A] flex items-center justify-center mx-auto mb-3 border border-[#DCD8CD]">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <p className="font-semibold text-[#2E3029] text-base">Nenhum compromisso encontrado</p>
            <p className="text-xs text-[#76766D] mt-1.5 max-w-sm mx-auto leading-relaxed">
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
              className="mt-4 inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#455243] hover:bg-[#384436] text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#C4D9C2]" />
              <span>Registrar Horário Agora</span>
            </button>
          </div>
        ) : groupedEvents ? (
          /* Grouped Events View (For 'week' and 'month' tabs) */
          <div className="space-y-6">
            {groupedEvents.map(({ dateStr, items }) => (
              <div key={dateStr} className="space-y-2.5">
                {/* Date header with day badge */}
                <div className="flex items-center space-x-3 pb-1.5 border-b border-[#EDEBE1]">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#5C6B5A]" />
                  <h3 className="text-xs sm:text-sm font-bold text-[#2E3029] capitalize">
                    {formatDayHeaderBR(dateStr)}
                  </h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#EDEBE1] text-[#5C6B5A] font-mono font-medium">
                    {items.length} {items.length === 1 ? 'compromisso' : 'compromissos'}
                  </span>
                </div>

                {/* Cards for that day */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
    <div className="group p-4 rounded-xl border border-[#E2DFD4] hover:border-[#8C9484] hover:shadow-xs bg-white hover:bg-[#FAF9F5]/60 transition-all flex flex-col justify-between">
      <div>
        {/* Classification Badges */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
          <span
            className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${classified.badgeClass}`}
          >
            {classified.eventSubtype === 'workshop' && <Wrench className="w-3 h-3 text-[#6B4B9A]" />}
            {classified.eventSubtype === 'treinamento' && <BookOpen className="w-3 h-3 text-[#6B4B9A]" />}
            {classified.eventSubtype === 'formacao' && (
              <GraduationCap className="w-3 h-3 text-[#6B4B9A]" />
            )}
            {classified.eventSubtype === 'transmissao_online' && (
              <Radio className="w-3 h-3 text-[#6B4B9A]" />
            )}
            <span>{classified.label}</span>
          </span>

          <span className="text-[11px] text-[#76766D] bg-[#FAF9F5] px-2 py-0.5 rounded border border-[#EDEBE1] font-mono">
            {classified.durationLabel}
          </span>
        </div>

        {/* Title */}
        <div className="flex items-start space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#5C6B5A] mt-1.5 shrink-0" />
          <h4 className="font-semibold text-[#2E3029] text-sm leading-snug break-words">
            {ev.title}
          </h4>
        </div>

        {/* Time and Location */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-[#5C6B5A]">
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-[#8C9484] shrink-0" />
            <span className="font-medium">
              {formatTimeBR(ev.start)} – {formatTimeBR(ev.end)}
            </span>
          </div>

          {ev.location && (
            <span className="text-[#76766D] text-[11px] truncate">• {ev.location}</span>
          )}
        </div>

        {/* Description Snippet if available */}
        {ev.description && (
          <p className="text-[11px] text-[#76766D] mt-2 line-clamp-2 bg-[#FAF9F5] p-2 rounded-lg border border-[#EDEBE1]">
            {ev.description}
          </p>
        )}

        {/* Attendees / Professional */}
        {ev.attendees && ev.attendees.length > 0 && (
          <div className="flex items-center space-x-1.5 mt-2.5 text-xs text-[#76766D]">
            <Users className="w-3.5 h-3.5 text-[#8C9484] shrink-0" />
            <span className="truncate">
              {ev.attendees.length} participante(s): {ev.attendees.slice(0, 2).join(', ')}
              {ev.attendees.length > 2 ? ` +${ev.attendees.length - 2}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Footer Actions: Meet link, Google Calendar Link, Reagendar, Cancelar */}
      <div className="pt-3 mt-3 border-t border-[#EDEBE1] flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          {hasMeet && (
            <a
              href={ev.meetLink!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-[#EBF0E9] text-[#4F6F52] hover:bg-[#DEE8DC] text-xs font-medium border border-[#C5D8C3] transition-colors"
              title="Abrir sala do Google Meet"
            >
              <Video className="w-3.5 h-3.5 text-[#4F6F52]" />
              <span>Meet</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}

          {ev.htmlLink && (
            <a
              href={ev.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-[11px] text-[#5C6B5A] hover:text-[#2E3029] hover:underline"
              title="Ver no Google Agenda"
            >
              <span>Google Agenda</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}
        </div>

        <div className="flex items-center space-x-1.5 text-xs">
          <button
            type="button"
            onClick={() =>
              onSelectSlotForAssistant(
                `Reagendar ou alterar o horário do compromisso "${ev.title}" (ID: ${ev.id}) marcado para ${formatDateTimeBR(
                  ev.start
                )}.`
              )
            }
            className="text-[11px] text-[#5C6B5A] hover:text-[#2E3029] hover:underline cursor-pointer font-medium"
          >
            Reagendar
          </button>
          <span className="text-[#DCD8CD]">|</span>
          <button
            type="button"
            onClick={() => onRequestCancel(ev)}
            className="text-[11px] text-[#A25852] hover:text-[#803F3A] hover:underline cursor-pointer font-medium"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
