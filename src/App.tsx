import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Users, 
  Video, 
  MapPin, 
  Clock, 
  MessageSquare, 
  ChevronRight,
  Sparkles,
  UserPlus,
  Mail,
  Filter,
  Send,
  X,
  Trash2,
  CheckCircle2,
  Database,
  Loader2,
  MessageCircle,
  Phone,
  Bell,
  BarChart3
} from 'lucide-react';
import type { Evento, TherapistUser } from './types';
import { 
  subscribeToEvents, 
  saveEvent, 
  deleteEvent, 
  subscribeToTherapists, 
  saveTherapist, 
  deleteTherapist,
  DEFAULT_EVENTS,
  DEFAULT_THERAPISTS
} from './lib/firestoreService';
import { DayScheduleView } from './components/DayScheduleView';
import { WeekScheduleView } from './components/WeekScheduleView';
import { MonthScheduleView } from './components/MonthScheduleView';
import { EventDetailsModal } from './components/EventDetailsModal';
import { WeeklyAttendanceSummary } from './components/WeeklyAttendanceSummary';

export default function Dashboard() {
  // --- ESTADOS DO FIRESTORE ---
  const [events, setEvents] = useState<Evento[]>(DEFAULT_EVENTS);
  const [therapists, setTherapists] = useState<TherapistUser[]>(DEFAULT_THERAPISTS);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingTherapists, setIsLoadingTherapists] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- ESTADOS DE FILTRO E VISUALIZAÇÃO ---
  const todayStr = new Date().toISOString().split('T')[0];
  const [activeCategory, setActiveCategory] = useState<'all' | 'atendimento' | 'reuniao' | 'evento'>('all');
  const [viewPeriod, setViewPeriod] = useState<'dia' | 'semana' | 'mes' | 'todos'>('dia');
  const [selectedTherapist, setSelectedTherapist] = useState<string>('todos');
  const [selectedDateForDay, setSelectedDateForDay] = useState<string>(todayStr);

  // --- ESTADOS DE MODAIS ---
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [selectedEventForDetails, setSelectedEventForDetails] = useState<Evento | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- FORMULÁRIO DE NOVO EVENTO ---
  const [newEvent, setNewEvent] = useState({
    title: '',
    category: 'atendimento' as 'atendimento' | 'reuniao' | 'evento',
    date: todayStr,
    time: '14:00 - 15:00',
    location: 'Sala do Instituto RenovaSer',
    type: 'presencial' as 'presencial' | 'online',
    therapistId: 'admin1',
    clientEmail: '',
    clientWhatsApp: ''
  });

  // --- FORMULÁRIO DE NOVO UTILIZADOR ---
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'terapeuta' as 'admin' | 'terapeuta',
    technique: ''
  });

  // --- ESTADO DO CHAT / ASSISTENTE ---
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; action?: 'open_modal' }>>([
    {
      sender: 'assistant',
      text: 'Olá! Como posso ajudar na agenda hoje? Experimente dizer: "Agendar atendimento clínico amanhã às 14h" ou clique em "Marcar horário".'
    }
  ]);

  // Notificação com auto-dismiss
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // --- INSCRIÇÃO EM TEMPO REAL NO FIRESTORE ---
  useEffect(() => {
    const unsubEvents = subscribeToEvents(
      (firestoreEvents) => {
        setEvents(firestoreEvents);
        setIsLoadingEvents(false);
      },
      (error) => {
        console.warn('Erro ao carregar eventos do Firestore:', error);
        setIsLoadingEvents(false);
      }
    );

    const unsubTherapists = subscribeToTherapists(
      (firestoreTherapists) => {
        setTherapists(firestoreTherapists);
        setIsLoadingTherapists(false);
      },
      (error) => {
        console.warn('Erro ao carregar terapeutas do Firestore:', error);
        setIsLoadingTherapists(false);
      }
    );

    return () => {
      unsubEvents();
      unsubTherapists();
    };
  }, []);

  // Sincronizar therapistId inicial com o primeiro terapeuta disponível
  useEffect(() => {
    if (therapists.length > 0 && !therapists.some((t) => t.id === newEvent.therapistId)) {
      setNewEvent((prev) => ({ ...prev, therapistId: therapists[0].id }));
    }
  }, [therapists]);

  // Abrir modal de novo evento pré-configurado
  const openNewEventAt = (dateStr?: string, hourStr?: string) => {
    const targetDate = dateStr || todayStr;
    let targetTime = '14:00 - 15:00';
    if (hourStr) {
      if (hourStr.includes('-')) {
        targetTime = hourStr;
      } else {
        const h = parseInt(hourStr.split(':')[0], 10);
        const nextH = !isNaN(h) ? (h + 1).toString().padStart(2, '0') : '15';
        targetTime = `${hourStr} - ${nextH}:00`;
      }
    }
    setNewEvent((prev) => ({
      ...prev,
      date: targetDate,
      time: targetTime
    }));
    setShowNewEventModal(true);
  };

  // Rolar suavemente até a seção de Resumo de Atendimentos
  const scrollToSummary = () => {
    const el = document.getElementById('resumo-atendimentos');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // --- LÓGICA DE CRIAÇÃO DE EVENTO NO FIRESTORE ---
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;

    setIsSubmitting(true);
    try {
      const badgeColor =
        newEvent.category === 'atendimento'
          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
          : newEvent.category === 'reuniao'
          ? 'bg-blue-100 text-blue-800 border-blue-200'
          : 'bg-purple-100 text-purple-800 border-purple-200';

      const eventData: Omit<Evento, 'id'> = {
        title: newEvent.title.trim(),
        category: newEvent.category,
        time: newEvent.time.trim(),
        date: newEvent.date,
        location: newEvent.location.trim(),
        type: newEvent.type,
        therapistId: newEvent.therapistId,
        clientEmail: newEvent.clientEmail.trim(),
        clientWhatsApp: newEvent.clientWhatsApp.trim(),
        badgeColor,
        createdAt: new Date().toISOString()
      };

      await saveEvent(eventData);

      setShowNewEventModal(false);
      setNewEvent({
        title: '',
        category: 'atendimento',
        date: todayStr,
        time: '14:00 - 15:00',
        location: 'Sala do Instituto RenovaSer',
        type: 'presencial',
        therapistId: therapists[0]?.id || 'admin1',
        clientEmail: '',
        clientWhatsApp: ''
      });

      showNotification('Compromisso gravado com sucesso!');
    } catch (err: any) {
      showNotification('Erro ao salvar agendamento: ' + (err.message || err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- EXCLUIR EVENTO ---
  const handleDeleteEvent = async (id: string, title: string) => {
    if (!window.confirm(`Deseja realmente excluir "${title}"?`)) {
      return;
    }

    try {
      await deleteEvent(id);
      if (selectedEventForDetails?.id === id) {
        setSelectedEventForDetails(null);
      }
      showNotification(`"${title}" removido com sucesso.`);
    } catch (err: any) {
      showNotification('Erro ao excluir evento: ' + (err.message || err), 'error');
    }
  };

  // --- LÓGICA DE CADASTRO DE UTILIZADOR ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim()) return;

    setIsSubmitting(true);
    try {
      await saveTherapist({
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        role: newUser.role,
        technique: newUser.technique.trim() || undefined,
        createdAt: new Date().toISOString()
      });

      setShowNewUserModal(false);
      setNewUser({ name: '', email: '', role: 'terapeuta', technique: '' });
      showNotification(`Profissional "${newUser.name}" cadastrado com sucesso!`);
    } catch (err: any) {
      showNotification('Erro ao cadastrar profissional: ' + (err.message || err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- LÓGICA DO ASSISTENTE INTELIGENTE ---
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput('');

    const lower = userMsg.toLowerCase();

    // Tratamento especial para mensagens genéricas como "marcar horário"
    const isGenericBooking = 
      lower === 'marcar horário' || 
      lower === 'marcar horario' || 
      lower === 'agendar' || 
      lower === 'novo agendamento' ||
      lower === 'agendar horário' ||
      lower === 'agendar horario';

    if (isGenericBooking) {
      setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: 'Com certeza! Você pode clicar no botão abaixo para abrir o formulário completo de agendamento ou me dizer os detalhes como: "Agendar atendimento clínico amanhã às 14h com Dr. Lucas".',
            action: 'open_modal'
          }
        ]);
      }, 300);
      return;
    }

    // Detecção de intenção com dados específicos
    const isScheduling = 
      lower.includes('agendar') || 
      lower.includes('marcar') || 
      lower.includes('reunião') || 
      lower.includes('reuniao') || 
      lower.includes('atendimento');

    if (isScheduling) {
      const isReuniao = lower.includes('reuni') || lower.includes('equipe');
      const isOnline = lower.includes('online') || lower.includes('meet') || lower.includes('zoom');
      const isTomorrow = lower.includes('amanhã') || lower.includes('amanha');
      
      let dateVal = todayStr;
      if (isTomorrow) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateVal = tomorrow.toISOString().split('T')[0];
      }

      let timeVal = '19:30 - 20:30';
      const timeMatch = lower.match(/(\d{1,2})[h:](\d{2})?/);
      if (timeMatch) {
        const h = timeMatch[1].padStart(2, '0');
        const m = timeMatch[2] || '00';
        const nextHour = (parseInt(h, 10) + 1).toString().padStart(2, '0');
        timeVal = `${h}:${m} - ${nextHour}:${m}`;
      }

      // Extração inteligente do título
      let titleVal = isReuniao
        ? 'Reunião com a Equipe de Terapeutas'
        : 'Atendimento Terapêutico';

      if (lower.includes('com dr.') || lower.includes('com dra.')) {
        titleVal = `Atendimento Clínico`;
      }

      const locationVal = isOnline
        ? 'Online - Google Meet'
        : 'Sala do Instituto RenovaSer';

      const categoryVal: 'reuniao' | 'atendimento' | 'evento' = isReuniao ? 'reuniao' : 'atendimento';

      const newEvt: Omit<Evento, 'id'> = {
        title: titleVal,
        category: categoryVal,
        time: timeVal,
        date: dateVal,
        location: locationVal,
        type: isOnline ? 'online' : 'presencial',
        therapistId: therapists[0]?.id || 'admin1',
        clientEmail: '',
        clientWhatsApp: '',
        badgeColor: isReuniao 
          ? 'bg-blue-100 text-blue-800 border-blue-200' 
          : 'bg-emerald-100 text-emerald-800 border-emerald-200',
        createdAt: new Date().toISOString()
      };

      try {
        await saveEvent(newEvt);
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: `Perfeito! Agendei e gravei diretamente no Firebase: "${titleVal}" para ${dateVal} às ${timeVal} (${isOnline ? 'Online' : 'Presencial'}). Já visível no painel!`
          }
        ]);
        showNotification('Compromisso agendado pela IA e salvo no Firebase!');
      } catch (err: any) {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: `Ocorreu uma falha ao persistir no Firebase: ${err.message || err}. Verifique a conexão.`
          }
        ]);
      }
    } else {
      setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: `Entendido! Estou pronto para auxiliar na agenda do Instituto RenovaSer. Você pode pedir para agendar reuniões, atendimentos clínicos ou clicar em "Marcar horário".`,
            action: 'open_modal'
          }
        ]);
      }, 400);
    }
  };

  // --- FILTRAGEM DE EVENTOS ---
  const filteredEvents = events.filter((e) => {
    const matchCategory = activeCategory === 'all' || e.category === activeCategory;
    const matchTherapist = selectedTherapist === 'todos' || e.therapistId === selectedTherapist;

    return matchCategory && matchTherapist;
  });

  // Mapeamento de Terapeuta
  const therapistMap = therapists.reduce<Record<string, string>>((acc, t) => {
    acc[t.id] = t.technique ? `${t.name} (${t.technique})` : t.name;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* Toast de Notificação */}
      {notification && (
        <div 
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium flex items-center gap-2 transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {notification.message}
        </div>
      )}

      {/* Topbar / Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              RS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 leading-none">Instituto RenovaSer</h1>
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Firebase Conectado
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Agenda & Gestão Integrada</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={scrollToSummary}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 shadow-2xs"
            >
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Resumo de Atendimentos</span>
              <span className="sm:hidden">Resumo</span>
            </button>
            <button 
              onClick={() => setShowNewUserModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
            >
              <UserPlus className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Cadastrar Utilizador</span>
              <span className="sm:hidden">Utilizador</span>
            </button>
            <button 
              onClick={() => openNewEventAt()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Agendamento</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Painel Principal */}
        <section className="lg:col-span-2 space-y-6">
          
          {/* Banner */}
          <div className="bg-gradient-to-r from-emerald-800 to-teal-700 rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-200 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> Sincronização em Nuvem
              </span>
              <h2 className="text-2xl font-bold mt-1">Transformação e Desenvolvimento Humano</h2>
              <p className="text-emerald-100 text-sm mt-1">
                Acompanhe e gerencie os atendimentos, reuniões e eventos com facilidade e precisão.
              </p>
            </div>
            <button
              onClick={scrollToSummary}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl text-xs font-semibold text-white transition-all backdrop-blur-xs shrink-0 self-start sm:self-auto shadow-2xs"
            >
              <BarChart3 className="w-4 h-4 text-emerald-300" />
              Ver Resumo Semanal
            </button>
          </div>

          {/* Barra de Filtros e Seleção de Período */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              {/* Filtro de Categoria */}
              <div className="flex gap-2">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'atendimento', label: 'Atendimentos' },
                  { id: 'reuniao', label: 'Reuniões' },
                  { id: 'evento', label: 'Eventos' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCategory(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeCategory === tab.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Seletor de Período Solicitado */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {[
                  { id: 'dia', label: 'Dia' },
                  { id: 'semana', label: 'Semana' },
                  { id: 'mes', label: 'Mês' },
                  { id: 'todos', label: 'Todos' }
                ].map((period) => (
                  <button
                    key={period.id}
                    onClick={() => setViewPeriod(period.id as any)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      viewPeriod === period.id 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Seleção de Profissional / Admin */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Responsável:
                </span>
                <select
                  value={selectedTherapist}
                  onChange={(e) => setSelectedTherapist(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                >
                  <option value="todos">Todos os Profissionais / Admins ({therapists.length})</option>
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.technique ? `(${t.technique})` : `(${t.role === 'admin' ? 'Admin' : 'Terapeuta'})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-slate-500">
                Total ativo: <strong className="text-slate-900">{filteredEvents.length}</strong> compromisso(s)
              </div>
            </div>
          </div>

          {/* Área Principal dos Agendamentos (Renderização Baseada no Período Selecionado) */}
          <div>
            {isLoadingEvents ? (
              <div className="py-12 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <span>Carregando agenda...</span>
              </div>
            ) : (
              <>
                {/* 1. VISUALIZAÇÃO DIA: 2 Colunas (Manhã e Tarde) */}
                {viewPeriod === 'dia' && (
                  <DayScheduleView
                    events={filteredEvents}
                    selectedDate={selectedDateForDay}
                    onDateChange={setSelectedDateForDay}
                    onSelectEvent={(evt) => setSelectedEventForDetails(evt)}
                    onAddEventAtHour={(date, hour) => openNewEventAt(date, hour)}
                    therapists={therapists}
                  />
                )}

                {/* 2. VISUALIZAÇÃO SEMANA: Tabela em 6 Colunas (Segunda a Sábado) */}
                {viewPeriod === 'semana' && (
                  <WeekScheduleView
                    events={filteredEvents}
                    onSelectEvent={(evt) => setSelectedEventForDetails(evt)}
                    onAddEventAtDate={(date) => openNewEventAt(date)}
                    therapists={therapists}
                  />
                )}

                {/* 3. VISUALIZAÇÃO MÊS: Grade com 31 Quadrados e Sinalização de Horários */}
                {viewPeriod === 'mes' && (
                  <MonthScheduleView
                    events={filteredEvents}
                    onSelectEvent={(evt) => setSelectedEventForDetails(evt)}
                    onAddEventAtDate={(date) => openNewEventAt(date)}
                    therapists={therapists}
                  />
                )}

                {/* 4. VISUALIZAÇÃO TODOS: Lista Cronológica com Detalhes ao Clicar */}
                {viewPeriod === 'todos' && (
                  <div className="space-y-3">
                    {filteredEvents.length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400 text-xs space-y-2">
                        <p>Nenhum compromisso encontrado para os filtros selecionados.</p>
                        <button
                          onClick={() => {
                            setActiveCategory('all');
                            setSelectedTherapist('todos');
                          }}
                          className="text-emerald-600 hover:underline font-medium"
                        >
                          Limpar filtros
                        </button>
                      </div>
                    ) : (
                      filteredEvents.map((evt) => {
                        const responsibleName = therapistMap[evt.therapistId] || 'Equipe RenovaSer';

                        return (
                          <div 
                            key={evt.id}
                            onClick={() => setSelectedEventForDetails(evt)}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all flex items-center justify-between gap-4 cursor-pointer group"
                          >
                            <div className="space-y-1.5 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${evt.badgeColor}`}>
                                  {evt.category.toUpperCase()}
                                </span>
                                <h3 className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                                  {evt.title}
                                </h3>
                                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                  Resp: <strong className="text-slate-700">{responsibleName}</strong>
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-0.5">
                                <span className="flex items-center gap-1 font-medium text-slate-600">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  {evt.time} ({evt.date})
                                </span>
                                <span className="flex items-center gap-1">
                                  {evt.type === 'online' ? (
                                    <Video className="w-3.5 h-3.5 text-blue-500" />
                                  ) : (
                                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                                  )}
                                  {evt.location}
                                </span>

                                {/* Contato para Notificação Antecipada */}
                                {evt.clientWhatsApp && (
                                  <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-medium">
                                    <MessageCircle className="w-3 h-3 text-emerald-600" />
                                    WhatsApp: {evt.clientWhatsApp}
                                  </span>
                                )}
                                {evt.clientEmail && !evt.clientWhatsApp && (
                                  <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                    <Mail className="w-3 h-3 text-slate-400" />
                                    {evt.clientEmail}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                                Ver Informações
                              </span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEvent(evt.id, evt.title);
                                }}
                                title="Excluir compromisso"
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Lateral: Assistente Integrado e Equipe */}
        <aside className="space-y-6">
          {/* Assistente Integrado */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col h-[480px]">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Assistente RenovaSer</h3>
                <p className="text-[11px] text-slate-500">Agendamento por Voz ou Texto</p>
              </div>
            </div>

            {/* Mensagens do Chat */}
            <div className="flex-1 my-4 space-y-3 overflow-y-auto text-xs pr-1">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl max-w-[90%] leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white ml-auto'
                      : 'bg-slate-100 text-slate-700 mr-auto'
                  }`}
                >
                  <p>{msg.text}</p>
                  {msg.action === 'open_modal' && (
                    <button
                      onClick={() => openNewEventAt()}
                      className="mt-2.5 w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Abrir Formulário de Agendamento
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Ações Rápidas do Assistente */}
            <div className="flex items-center gap-1.5 pb-2 overflow-x-auto text-[10px]">
              <button
                onClick={() => {
                  setChatInput('Marcar horário');
                  setTimeout(() => handleSendMessage(), 50);
                }}
                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-full border border-emerald-200 font-semibold whitespace-nowrap transition-colors"
              >
                Marcar horário
              </button>
              <button
                onClick={() => {
                  setChatInput('Agendar reunião com a equipe de terapeutas hoje às 19h30');
                  setTimeout(() => handleSendMessage(), 50);
                }}
                className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-full border border-slate-200 whitespace-nowrap transition-colors"
              >
                Reunião de equipe hoje 19h30
              </button>
            </div>

            {/* Input de Envio */}
            <div className="relative pt-1">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ex: Agendar atendimento amanhã às 14h..."
                className="w-full pl-3 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
              <button 
                onClick={handleSendMessage}
                className="absolute right-2 top-3 text-emerald-600 hover:text-emerald-700 p-1"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mini Painel de Profissionais Cadastrados */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <h4 className="text-xs font-bold text-slate-800">Equipe & Admins ({therapists.length})</h4>
              </div>
              <button
                onClick={() => setShowNewUserModal(true)}
                className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                + Adicionar
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {therapists.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="truncate pr-2">
                    <p className="font-semibold text-slate-800 truncate">{t.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {t.technique && (
                        <span className="text-[10px] text-emerald-800 bg-emerald-100/70 px-1.5 py-0.2 rounded font-medium border border-emerald-200">
                          {t.technique}
                        </span>
                      )}
                      <p className="text-[10px] text-slate-500 truncate">{t.email}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                    t.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {t.role === 'admin' ? 'Admin' : 'Terapeuta'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

      </main>

      {/* SEÇÃO: RESUMO DE ATENDIMENTOS DA SEMANA (GRÁFICO RECHARTS) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 w-full">
        <WeeklyAttendanceSummary
          events={events}
          therapists={therapists}
          onSelectCategory={(cat) => {
            setActiveCategory(cat);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onScrollToTop={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </div>

      {/* MODAL DE INFORMAÇÕES COMPLETAS DO AGENDAMENTO */}
      <EventDetailsModal
        event={selectedEventForDetails}
        onClose={() => setSelectedEventForDetails(null)}
        onDelete={handleDeleteEvent}
        therapists={therapists}
      />

      {/* MODAL: NOVO AGENDAMENTO COM WHATSAPP / E-MAIL OBRIGATÓRIOS PARA NOTIFICAÇÃO */}
      {showNewEventModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Criar Novo Agendamento</h3>
                <p className="text-[11px] text-slate-500">Configure os dados do compromisso e a notificação do cliente</p>
              </div>
              <button onClick={() => setShowNewEventModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3.5 text-xs">
              <div>
                <label className="font-medium text-slate-700 block mb-1">Título do Compromisso</label>
                <input
                  type="text"
                  required
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Ex: Atendimento Clínico ou Reunião de Equipe"
                  className="w-full p-2.5 bg-slate-50 border rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Categoria</label>
                  <select
                    value={newEvent.category}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 border rounded-lg"
                  >
                    <option value="atendimento">Atendimento</option>
                    <option value="reuniao">Reunião</option>
                    <option value="evento">Evento</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Responsável / Terapeuta</label>
                  <select
                    value={newEvent.therapistId}
                    onChange={(e) => setNewEvent({ ...newEvent, therapistId: e.target.value })}
                    className="w-full p-2 bg-slate-50 border rounded-lg"
                  >
                    {therapists.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.technique ? `— ${t.technique}` : `(${t.role === 'admin' ? 'Admin' : 'Terapeuta'})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full p-2 bg-slate-50 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Horário (ex: 09:30 - 10:30)</label>
                  <input
                    type="text"
                    required
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    placeholder="09:30 - 10:30"
                    className="w-full p-2 bg-slate-50 border rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Modalidade</label>
                  <select
                    value={newEvent.type}
                    onChange={(e) => {
                      const val = e.target.value as 'presencial' | 'online';
                      setNewEvent({
                        ...newEvent,
                        type: val,
                        location: val === 'online' ? 'Online - Google Meet' : 'Sala do Instituto RenovaSer'
                      });
                    }}
                    className="w-full p-2 bg-slate-50 border rounded-lg"
                  >
                    <option value="presencial">Presencial</option>
                    <option value="online">Online</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Local / Link</label>
                  <input
                    type="text"
                    required
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    className="w-full p-2 bg-slate-50 border rounded-lg"
                  />
                </div>
              </div>

              {/* BLOCO DE NOTIFICAÇÃO ANTECIPADA: WHATSAPP E E-MAIL DO CLIENTE */}
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="font-bold text-emerald-900 text-xs">
                    Dados do Cliente para Notificação Antecipada
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1 text-[11px]">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp do Cliente
                    </label>
                    <input
                      type="tel"
                      value={newEvent.clientWhatsApp}
                      onChange={(e) => setNewEvent({ ...newEvent, clientWhatsApp: e.target.value })}
                      placeholder="(11) 98765-4321"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1 text-[11px]">
                      <Mail className="w-3.5 h-3.5 text-slate-500" /> E-mail do Cliente
                    </label>
                    <input
                      type="email"
                      value={newEvent.clientEmail}
                      onChange={(e) => setNewEvent({ ...newEvent, clientEmail: e.target.value })}
                      placeholder="cliente@email.com"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-emerald-800">
                  * O WhatsApp ou e-mail serão utilizados para enviar o aviso de confirmação e lembrete antecipado da sessão.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowNewEventModal(false)}
                  className="px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Salvar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRO DE UTILIZADOR */}
      {showNewUserModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Cadastrar Novo Utilizador</h3>
              <button onClick={() => setShowNewUserModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-slate-700 block mb-1">Nome Completo</label>
                <input 
                  type="text" 
                  required 
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Nome do profissional" 
                  className="w-full p-2 bg-slate-50 border rounded-lg focus:outline-none focus:border-emerald-500" 
                />
              </div>
              <div>
                <label className="font-medium text-slate-700 block mb-1">E-mail Profissional</label>
                <input 
                  type="email" 
                  required 
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="email@renovaser.com" 
                  className="w-full p-2 bg-slate-50 border rounded-lg focus:outline-none focus:border-emerald-500" 
                />
              </div>
              <div>
                <label className="font-medium text-slate-700 block mb-1">
                  Técnica / Terapia <span className="text-slate-400 font-normal">(ex: Reiki, Tarô, Florais)</span>
                </label>
                <input 
                  type="text" 
                  value={newUser.technique}
                  onChange={(e) => setNewUser({ ...newUser, technique: e.target.value })}
                  placeholder="Ex: Reiki, Tarô, Florais, Constelação..." 
                  className="w-full p-2 bg-slate-50 border rounded-lg focus:outline-none focus:border-emerald-500" 
                />
              </div>
              <div>
                <label className="font-medium text-slate-700 block mb-1">Função</label>
                <select 
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                >
                  <option value="terapeuta">Terapeuta</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button 
                  type="button" 
                  disabled={isSubmitting}
                  onClick={() => setShowNewUserModal(false)} 
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Cadastrar Utilizador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}