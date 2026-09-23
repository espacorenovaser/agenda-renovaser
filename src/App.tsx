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
  BarChart3,
  LogOut,
  KeyRound,
  Shield,
  UserCheck,
  DoorOpen,
  Layers,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import type { Evento, TherapistUser, RoomId } from './types';
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
import { 
  initAuth, 
  googleSignIn, 
  getAccessToken, 
  logout as googleLogout 
} from './lib/firebase';
import type { User } from 'firebase/auth';
import { 
  createGoogleCalendarEvent, 
  deleteGoogleCalendarEvent, 
  fetchGoogleCalendarEvents 
} from './lib/googleCalendarService';
import { 
  getRoomById, 
  checkRoomAvailability, 
  validateRoomBooking,
  RENOVASER_ROOMS 
} from './lib/roomService';
import { parseAssistantCommand } from './lib/assistantParser';
import { getCurrentSessionUser, logoutSession } from './lib/authService';
import { LoginScreen } from './components/LoginScreen';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { DayScheduleView } from './components/DayScheduleView';
import { WeekScheduleView } from './components/WeekScheduleView';
import { MonthScheduleView } from './components/MonthScheduleView';
import { EventDetailsModal } from './components/EventDetailsModal';
import { WeeklyAttendanceSummary } from './components/WeeklyAttendanceSummary';
import { RoomSelector } from './components/RoomSelector';
import { RoomsOccupancyBar } from './components/RoomsOccupancyBar';

export default function Dashboard() {
  // --- ESTADO DE AUTENTICAÇÃO E SESSÃO ---
  const [currentUser, setCurrentUser] = useState<TherapistUser | null>(() => getCurrentSessionUser());
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

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
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<RoomId | 'todos'>('todos');
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
    location: 'Sala 1 • Harmonia',
    type: 'presencial' as 'presencial' | 'online',
    roomId: 'sala_1' as RoomId,
    roomName: 'Sala 1 • Harmonia',
    therapistId: 'admin1',
    clientEmail: '',
    clientWhatsApp: ''
  });

  // --- FORMULÁRIO DE NOVO UTILIZADOR ---
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'terapeuta' as 'admin' | 'terapeuta',
    technique: '',
    password: 'renovaser123'
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

  // --- ESTADO DO GOOGLE AGENDA (GOOGLE CALENDAR) ---
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);

  useEffect(() => {
    const unsubGoogleAuth = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => {
      unsubGoogleAuth();
    };
  }, []);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        showNotification(`Google Agenda conectada com sucesso (${res.user.email})!`);
        // Sincronizar eventos imediatamente
        await handleSyncGoogleCalendar(res.accessToken);
      }
    } catch (err: any) {
      console.error('Erro ao conectar Google Agenda:', err);
      showNotification(`Falha ao conectar Google Agenda: ${err?.message || err}`, 'error');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await googleLogout();
      setGoogleUser(null);
      setGoogleToken(null);
      showNotification('Google Agenda desconectada.');
    } catch (err: any) {
      console.error('Erro ao desconectar Google Agenda:', err);
    }
  };

  const handleSyncGoogleCalendar = async (tokenOverride?: string) => {
    const token = tokenOverride || googleToken || await getAccessToken();
    if (!token) {
      showNotification('Conecte sua conta do Google Agenda no topo da página para sincronizar.', 'error');
      return;
    }
    setIsSyncingGoogle(true);
    try {
      const gcalEvents = await fetchGoogleCalendarEvents(token);
      if (gcalEvents && gcalEvents.length > 0) {
        let syncedCount = 0;
        for (const gEvt of gcalEvents) {
          await saveEvent(gEvt);
          syncedCount++;
        }
        showNotification(`${syncedCount} compromissos sincronizados com o Google Agenda!`);
      } else {
        showNotification('Google Agenda consultada: todos os compromissos estão em dia.');
      }
    } catch (err: any) {
      console.error('Erro ao sincronizar com Google Agenda:', err);
      showNotification(`Erro ao sincronizar com Google Agenda: ${err?.message || err}`, 'error');
    } finally {
      setIsSyncingGoogle(false);
    }
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
  const openNewEventAt = (dateStr?: string, hourStr?: string, preferredRoomId?: RoomId) => {
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

    const assignedTherapistId =
      currentUser?.role === 'terapeuta'
        ? (therapists.find((t) => t.email.toLowerCase() === currentUser.email.toLowerCase())?.id || currentUser.id)
        : (selectedTherapist !== 'todos' ? selectedTherapist : (therapists[0]?.id || 'admin1'));

    // Calcular sala recomendada ou utilizar a preferida
    const availability = checkRoomAvailability(targetDate, targetTime, events);
    const chosenRoomId: RoomId = preferredRoomId || availability.firstAvailableRoomId || 'sala_1';
    const roomObj = getRoomById(chosenRoomId);

    setNewEvent((prev) => ({
      ...prev,
      date: targetDate,
      time: targetTime,
      therapistId: assignedTherapistId,
      roomId: chosenRoomId,
      roomName: roomObj ? roomObj.label : 'Sala 1 • Harmonia',
      location: roomObj ? roomObj.label : 'Sala 1 • Harmonia'
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

    // Validação de alocação de espaço físico (Salas 1, 2, 3 e Auditório)
    if (newEvent.type === 'presencial') {
      const roomValidation = validateRoomBooking(
        newEvent.roomId,
        newEvent.type,
        newEvent.date,
        newEvent.time,
        events
      );

      if (!roomValidation.valid) {
        showNotification(roomValidation.errorMessage || 'Espaço físico indisponível neste horário.', 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const badgeColor =
        newEvent.category === 'atendimento'
          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
          : newEvent.category === 'reuniao'
          ? 'bg-blue-100 text-blue-800 border-blue-200'
          : 'bg-purple-100 text-purple-800 border-purple-200';

      const selectedRoom = getRoomById(newEvent.roomId);
      const roomLabel = newEvent.type === 'presencial' ? (selectedRoom ? selectedRoom.label : newEvent.roomName) : undefined;

      let googleEventId: string | undefined = undefined;
      let googleHtmlLink: string | undefined = undefined;

      const activeToken = googleToken || await getAccessToken();
      if (activeToken) {
        try {
          const gcalRes = await createGoogleCalendarEvent({
            title: newEvent.title.trim(),
            category: newEvent.category,
            date: newEvent.date,
            time: newEvent.time.trim(),
            location: newEvent.location.trim(),
            roomName: roomLabel,
            clientEmail: newEvent.clientEmail.trim(),
            clientWhatsApp: newEvent.clientWhatsApp.trim(),
          }, activeToken);
          googleEventId = gcalRes.googleEventId;
          googleHtmlLink = gcalRes.htmlLink;
        } catch (gcalErr) {
          console.warn('Não foi possível gravar no Google Agenda:', gcalErr);
        }
      }

      const eventData: Omit<Evento, 'id'> = {
        title: newEvent.title.trim(),
        category: newEvent.category,
        time: newEvent.time.trim(),
        date: newEvent.date,
        location: newEvent.location.trim(),
        type: newEvent.type,
        roomId: newEvent.type === 'presencial' ? newEvent.roomId : undefined,
        roomName: roomLabel,
        therapistId: newEvent.therapistId,
        clientEmail: newEvent.clientEmail.trim(),
        clientWhatsApp: newEvent.clientWhatsApp.trim(),
        badgeColor,
        createdAt: new Date().toISOString(),
        googleEventId,
        googleHtmlLink,
        syncedWithGoogle: !!googleEventId
      };

      await saveEvent(eventData);

      setShowNewEventModal(false);
      setNewEvent({
        title: '',
        category: 'atendimento',
        date: todayStr,
        time: '14:00 - 15:00',
        location: 'Sala 1 • Harmonia',
        type: 'presencial',
        roomId: 'sala_1',
        roomName: 'Sala 1 • Harmonia',
        therapistId: therapists[0]?.id || 'admin1',
        clientEmail: '',
        clientWhatsApp: ''
      });

      if (googleEventId) {
        showNotification('Compromisso gravado e sincronizado com o Google Agenda com sucesso!');
      } else {
        showNotification('Compromisso gravado com sucesso com a sala confirmada!');
      }
    } catch (err: any) {
      showNotification('Erro ao salvar agendamento: ' + (err.message || err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- EXCLUIR EVENTO (COM CONFIRMAÇÃO DE OPERAÇÃO DESTRUTIVA) ---
  const handleDeleteEvent = async (id: string, title: string) => {
    const targetEvent = events.find((e) => e.id === id);
    const isGoogleSynced = !!targetEvent?.googleEventId;
    const confirmMsg = isGoogleSynced
      ? `Deseja realmente excluir "${title}"? Esta ação também removerá o compromisso do seu Google Agenda.`
      : `Deseja realmente excluir "${title}"?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      if (targetEvent?.googleEventId) {
        const activeToken = googleToken || await getAccessToken();
        if (activeToken) {
          try {
            await deleteGoogleCalendarEvent(targetEvent.googleEventId, activeToken);
          } catch (gcalDelErr) {
            console.warn('Erro ao excluir do Google Agenda:', gcalDelErr);
          }
        }
      }

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
    const candidateName = newUser.name.trim();
    const candidateEmail = newUser.email.trim();
    const candidateRole = newUser.role;
    const candidateTechnique = newUser.technique.trim();
    const candidatePassword = newUser.password.trim() || 'renovaser123';

    try {
      const generatedId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      
      // Atualização otimista imediata para que o usuário não fique esperando
      setTherapists((prev) => {
        const exists = prev.some((t) => t.email.toLowerCase() === candidateEmail.toLowerCase());
        if (exists) {
          return prev.map((t) => t.email.toLowerCase() === candidateEmail.toLowerCase()
            ? { ...t, name: candidateName, role: candidateRole, technique: candidateTechnique, password: candidatePassword }
            : t
          );
        }
        return [
          ...prev,
          {
            id: generatedId,
            name: candidateName,
            email: candidateEmail,
            role: candidateRole,
            technique: candidateTechnique,
            password: candidatePassword,
            createdAt: new Date().toISOString(),
          }
        ];
      });

      await saveTherapist({
        id: generatedId,
        name: candidateName,
        email: candidateEmail,
        role: candidateRole,
        technique: candidateTechnique || undefined,
        password: candidatePassword,
        createdAt: new Date().toISOString()
      });

      setShowNewUserModal(false);
      setNewUser({ name: '', email: '', role: 'terapeuta', technique: '', password: 'renovaser123' });
      showNotification(`Profissional "${candidateName}" cadastrado com sucesso!`);
    } catch (err: any) {
      console.error('Erro ao cadastrar profissional:', err);
      showNotification('Erro ao cadastrar profissional: ' + (err.message || err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- LIMPAR CHAT DO ASSISTENTE ---
  const handleClearChat = () => {
    setChatMessages([
      {
        sender: 'assistant',
        text: 'Histórico da conversa limpo! Como posso ajudar na agenda do RenovaSer hoje? Você pode escrever o agendamento desejado (ex: "Agendar dia 26/09 às 14h na Sala 1") ou clicar em "Marcar horário".'
      }
    ]);
    setChatInput('');
    showNotification('Histórico da conversa limpo com sucesso.');
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
            text: 'Com certeza! Você pode clicar no botão abaixo para abrir o formulário completo de agendamento ou me dizer os detalhes como: "Agendar atendimento amanhã às 14h na Sala 1".',
            action: 'open_modal'
          }
        ]);
      }, 300);
      return;
    }

    // Processamento inteligente do comando com suporte a múltiplas salas e intervalos de horário
    const parsed = parseAssistantCommand(userMsg, events, therapists);

    if (parsed.isBooking && parsed.items.length > 0) {
      try {
        const savedTitles: string[] = [];
        const activeToken = googleToken || await getAccessToken();
        let anyGcalSuccess = false;

        for (const item of parsed.items) {
          let googleEventId: string | undefined = undefined;
          let googleHtmlLink: string | undefined = undefined;

          if (activeToken) {
            try {
              const gcalRes = await createGoogleCalendarEvent({
                title: item.title,
                category: item.category,
                date: item.date,
                time: item.time,
                location: item.location,
                roomName: item.roomName,
              }, activeToken);
              googleEventId = gcalRes.googleEventId;
              googleHtmlLink = gcalRes.htmlLink;
              anyGcalSuccess = true;
            } catch (gcalErr) {
              console.warn('Erro ao criar no Google Agenda:', gcalErr);
            }
          }

          const newEvt: Omit<Evento, 'id'> = {
            title: item.title,
            category: item.category,
            time: item.time,
            date: item.date,
            location: item.location,
            type: item.type,
            roomId: item.roomId,
            roomName: item.roomName,
            therapistId: item.therapistId,
            clientEmail: '',
            clientWhatsApp: '',
            badgeColor: item.category === 'reuniao'
              ? 'bg-blue-100 text-blue-800 border-blue-200'
              : item.category === 'evento'
              ? 'bg-purple-100 text-purple-800 border-purple-200'
              : 'bg-emerald-100 text-emerald-800 border-emerald-200',
            createdAt: new Date().toISOString(),
            googleEventId,
            googleHtmlLink,
            syncedWithGoogle: !!googleEventId
          };

          await saveEvent(newEvt);
          savedTitles.push(`${item.roomName || item.location}: ${item.title}`);
        }

        const firstItem = parsed.items[0];
        const [year, month, day] = firstItem.date.split('-');
        const formattedDate = day && month && year ? `${day}/${month}/${year}` : firstItem.date;
        const gcalNotice = anyGcalSuccess
          ? '\n\n📅 Sincronizado e salvo diretamente no Google Agenda!'
          : (!activeToken ? '\n\n💡 Dica: Conecte sua conta do Google Agenda no topo da página para salvar seus agendamentos diretamente no calendário Google.' : '');

        if (parsed.items.length > 1) {
          const summaryList = parsed.items
            .map((it) => `• ${it.roomName || it.location}: "${it.title}"`)
            .join('\n');

          setChatMessages((prev) => [
            ...prev,
            {
              sender: 'assistant',
              text: `Perfeito! Agendei e reservei na agenda ${parsed.items.length} atendimentos para a data ${formattedDate} (${firstItem.time}):\n\n${summaryList}\n\nTodos os espaços físicos foram reservados com sucesso!${gcalNotice}`
            }
          ]);
          showNotification(`${parsed.items.length} agendamentos registrados com sucesso!`);
        } else {
          const isItemOnline = firstItem.type === 'online';
          const msgText = isItemOnline
            ? `Perfeito! Agendei a reunião online: "${firstItem.title}" para a data ${formattedDate} às ${firstItem.time} (Modalidade: Online - Google Meet). Espaços físicos liberados.${gcalNotice}`
            : `Perfeito! Agendei e reservei na agenda: "${firstItem.title}" para a data ${formattedDate} às ${firstItem.time} no espaço (${firstItem.roomName || firstItem.location}). O espaço físico já foi reservado!${gcalNotice}`;

          setChatMessages((prev) => [
            ...prev,
            {
              sender: 'assistant',
              text: msgText
            }
          ]);
          showNotification(isItemOnline ? 'Reunião online registrada na agenda!' : 'Compromisso registrado na agenda e sala reservada!');
        }
      } catch (err: any) {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: `Ocorreu uma falha ao salvar na agenda: ${err.message || err}. Por favor, tente novamente.`
          }
        ]);
      }
    } else {
      setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: `Recebi sua mensagem! Como não identifiquei o dia ou horário exato na mensagem, você pode me informar os detalhes (ex: "Agendar dia 26/09 às 15h na Sala 2") ou clicar no botão abaixo para abrir o formulário já com a seleção das salas:`,
            action: 'open_modal'
          }
        ]);
      }, 350);
    }
  };

  // --- FILTRAGEM DE EVENTOS COM CONTROLE DE ACESSO (RBAC) ---
  const filteredEvents = events.filter((e) => {
    // REGRA DE ACESSO: Terapeutas visualizam exclusivamente o que lhes diz respeito
    if (currentUser?.role === 'terapeuta') {
      const isMyEvent =
        e.therapistId === currentUser.id ||
        (therapists.find((t) => t.id === e.therapistId)?.email.toLowerCase() === currentUser.email.toLowerCase());
      
      const isGeneralTeamEvent =
        (e.category === 'reuniao' || e.category === 'evento') &&
        (e.title.toLowerCase().includes('equipe') ||
         e.title.toLowerCase().includes('instituto') ||
         e.title.toLowerCase().includes('geral'));

      if (!isMyEvent && !isGeneralTeamEvent) {
        return false;
      }
    }

    const matchCategory = activeCategory === 'all' || e.category === activeCategory;
    const matchTherapist = selectedTherapist === 'todos' || e.therapistId === selectedTherapist;
    const matchRoom = selectedRoomFilter === 'todos' || e.roomId === selectedRoomFilter;

    return matchCategory && matchTherapist && matchRoom;
  });

  // Mapeamento de Terapeuta
  const therapistMap = therapists.reduce<Record<string, string>>((acc, t) => {
    acc[t.id] = t.technique ? `${t.name} (${t.technique})` : t.name;
    return acc;
  }, {});

  // TELA DE LOGIN OBRIGATÓRIA: SE NÃO HOUVER USUÁRIO LOGADO COM SENHA
  if (!currentUser) {
    return (
      <LoginScreen
        therapists={therapists}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          showNotification(`Acesso autorizado! Bem-vindo(a), ${user.name}.`);
        }}
      />
    );
  }

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
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shadow-2xs shrink-0 p-0.5">
              <img 
                src="/LogoAgenda.png" 
                alt="Instituto RenovaSer" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const parent = (e.currentTarget as HTMLElement).parentElement;
                  if (parent) {
                    parent.className = 'w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-2xs';
                    parent.textContent = 'RS';
                  }
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 leading-none">Instituto RenovaSer</h1>
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Conectado
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Agenda & Gestão Integrada</p>
            </div>
          </div>

          {/* Dados do Usuário Logado & Ações do Cabeçalho */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Chip de Identificação do Usuário */}
            <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#FAF9F6] border border-[#E8E6DF]">
              <div className="w-7 h-7 rounded-lg bg-[#2E3C32] text-emerald-300 font-bold text-xs flex items-center justify-center">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 leading-none max-w-[140px] truncate">
                    {currentUser.name}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                    currentUser.role === 'admin'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}>
                    {currentUser.role === 'admin' ? 'Admin' : 'Terapeuta'}
                  </span>
                </div>
                {currentUser.technique && (
                  <span className="text-[10px] text-emerald-700 font-medium block leading-tight">
                    {currentUser.technique}
                  </span>
                )}
              </div>
            </div>

            {/* Botão Alterar Senha */}
            <button
              type="button"
              onClick={() => setShowChangePasswordModal(true)}
              title="Alterar minha senha individual"
              className="flex items-center gap-1.5 p-2 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden xl:inline text-[11px] font-medium">Alterar Senha</span>
            </button>

            {/* Botão Sair / Logout */}
            <button
              type="button"
              onClick={() => {
                logoutSession();
                setCurrentUser(null);
                showNotification('Sessão encerrada com sucesso.');
              }}
              title="Sair do Sistema"
              className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>

            <button
              onClick={scrollToSummary}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 shadow-2xs cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span className="hidden lg:inline">Resumo</span>
            </button>

            {/* Botão de Cadastrar Utilizador: Exclusivo para Administradores */}
            {currentUser.role === 'admin' && (
              <button 
                onClick={() => setShowNewUserModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-slate-600" />
                <span className="hidden sm:inline">Cadastrar Utilizador</span>
                <span className="sm:hidden">Utilizador</span>
              </button>
            )}

            {/* Status / Botão Google Agenda */}
            {googleUser ? (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-lg shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                  <span className="text-xs font-semibold text-blue-900 hidden sm:inline" title={googleUser.email || ''}>
                    Google Agenda
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSyncGoogleCalendar()}
                  disabled={isSyncingGoogle}
                  title="Sincronizar com Google Agenda"
                  className="p-1 hover:bg-blue-100 rounded text-blue-700 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGoogle ? 'animate-spin' : ''}`} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={isConnectingGoogle}
                title="Conectar com o Google Agenda para sincronizar seus compromissos"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{isConnectingGoogle ? 'Conectando...' : 'Google Agenda'}</span>
              </button>
            )}

            <button 
              onClick={() => openNewEventAt()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Agendamento</span>
            </button>
          </div>
        </div>
      </header>

      {/* Banner de Sincronização com Google Agenda */}
      {!googleUser ? (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-blue-900">
              <div className="w-6 h-6 rounded-md bg-white border border-blue-200 flex items-center justify-center shrink-0 shadow-2xs">
                <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <p className="font-medium">
                <strong className="font-bold text-blue-950">Sincronização com Google Agenda:</strong> Conecte sua conta do Google para manter e salvar todos os agendamentos diretamente no seu calendário.
              </p>
            </div>
            <button
              onClick={handleConnectGoogle}
              disabled={isConnectingGoogle}
              className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-300 shadow-2xs transition-all cursor-pointer text-xs"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isConnectingGoogle ? 'Conectando...' : 'Conectar Google Agenda'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/70 border-b border-emerald-200/80 px-4 py-1.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Google Agenda conectado ({googleUser.email}) — Agendamentos sincronizados com seu calendário.</span>
            </div>
            <button
              onClick={() => handleSyncGoogleCalendar()}
              disabled={isSyncingGoogle}
              className="font-semibold text-emerald-800 hover:text-emerald-950 underline cursor-pointer inline-flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingGoogle ? 'animate-spin' : ''}`} />
              <span>{isSyncingGoogle ? 'Sincronizando...' : 'Sincronizar agora'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Painel Principal */}
        <section className="lg:col-span-2 space-y-6">
          
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

            {/* Seleção de Profissional / Admin com RBAC */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Agenda de:
                </span>
                {currentUser.role === 'terapeuta' ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    <span><strong>{currentUser.name}</strong> {currentUser.technique ? `(${currentUser.technique})` : ''}</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-semibold ml-1">Sua Agenda</span>
                  </div>
                ) : (
                  <select
                    value={selectedTherapist}
                    onChange={(e) => setSelectedTherapist(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="todos">Todos os Profissionais / Admins ({therapists.length})</option>
                    {therapists.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.technique ? `(${t.technique})` : `(${t.role === 'admin' ? 'Admin' : 'Terapeuta'})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="text-xs text-slate-500">
                Total ativo: <strong className="text-slate-900">{filteredEvents.length}</strong> compromisso(s)
              </div>
            </div>
          </div>

          {/* Painel de Ocupação e Gestão dos Espaços Físicos (Salas 1, 2, 3 e Auditório) */}
          <RoomsOccupancyBar
            events={events}
            selectedDate={selectedDateForDay}
            therapists={therapists}
            selectedRoomFilter={selectedRoomFilter}
            onSelectRoomFilter={setSelectedRoomFilter}
            onQuickBookRoom={(roomId) => openNewEventAt(selectedDateForDay, undefined, roomId)}
          />

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
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col h-[620px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Assistente RenovaSer</h3>
                  <p className="text-[11px] text-slate-500">Agendamento por Texto ou Voz</p>
                </div>
              </div>

              {/* Botão Limpar Chat */}
              <button
                type="button"
                onClick={handleClearChat}
                title="Limpar mensagens da conversa"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-rose-200 transition-all cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Limpar chat</span>
              </button>
            </div>

            {/* Mensagens do Chat */}
            <div className="flex-1 my-3 space-y-3 overflow-y-auto text-xs pr-1">
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

            {/* Área de Escrita Ampliada Confortável */}
            <div className="pt-2 border-t border-slate-100">
              <div className="bg-slate-50 focus-within:bg-white rounded-xl border border-slate-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 transition-all shadow-2xs flex flex-col">
                <textarea
                  rows={4}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Escreva sua solicitação aqui com calma (ex: Agendar reunião para dia 25.09.26 às 13 horas com a equipe on-line)..."
                  className="w-full px-3.5 pt-3 pb-2 text-xs sm:text-[13px] bg-transparent resize-y min-h-[105px] max-h-[220px] focus:outline-none text-slate-800 placeholder:text-slate-400 leading-relaxed block"
                />

                {/* Barra de Ações Fixada Abaixo do Campo de Texto (Nunca Cobre o Texto) */}
                <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/70 rounded-b-xl">
                  <span className="text-[10px] text-slate-400 select-none">
                    <kbd className="font-mono bg-slate-200/80 text-slate-600 px-1 py-0.5 rounded text-[9px]">Enter</kbd> envia • <kbd className="font-mono bg-slate-200/80 text-slate-600 px-1 py-0.5 rounded text-[9px]">Shift+Enter</kbd> quebra linha
                  </span>
                  <button 
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer shrink-0"
                  >
                    <span>Enviar</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mini Painel de Profissionais Cadastrados */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <h4 className="text-xs font-bold text-slate-800">Equipe & Admins ({therapists.length})</h4>
              </div>
              {currentUser.role === 'admin' && (
                <button
                  onClick={() => setShowNewUserModal(true)}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                >
                  + Adicionar
                </button>
              )}
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
          events={currentUser.role === 'terapeuta' ? filteredEvents : events}
          therapists={
            currentUser.role === 'terapeuta'
              ? therapists.filter(
                  (t) =>
                    t.id === currentUser.id ||
                    t.email.toLowerCase() === currentUser.email.toLowerCase()
                )
              : therapists
          }
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
        currentUser={currentUser}
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
              <button onClick={() => setShowNewEventModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
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
                  {currentUser.role === 'terapeuta' ? (
                    <div className="w-full p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-medium flex items-center justify-between">
                      <span className="truncate">{currentUser.name} {currentUser.technique ? `(${currentUser.technique})` : ''}</span>
                      <span className="text-[10px] bg-emerald-200/80 text-emerald-800 px-1.5 py-0.5 rounded font-semibold shrink-0 ml-1">Sua Agenda</span>
                    </div>
                  ) : (
                    <select
                      value={newEvent.therapistId}
                      onChange={(e) => setNewEvent({ ...newEvent, therapistId: e.target.value })}
                      className="w-full p-2 bg-slate-50 border rounded-lg cursor-pointer"
                    >
                      {therapists.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.technique ? `— ${t.technique}` : `(${t.role === 'admin' ? 'Admin' : 'Terapeuta'})`}
                        </option>
                      ))}
                    </select>
                  )}
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
                  <label className="font-medium text-slate-700 block mb-1">Local / Detalhe</label>
                  <input
                    type="text"
                    required
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    className="w-full p-2 bg-slate-50 border rounded-lg"
                  />
                </div>
              </div>

              {/* SELETOR DE ESPAÇO FÍSICO (SALAS 1, 2, 3 E AUDITÓRIO) */}
              {newEvent.type === 'presencial' && (
                <RoomSelector
                  selectedRoomId={newEvent.roomId}
                  date={newEvent.date}
                  time={newEvent.time}
                  events={events}
                  onChangeRoom={(roomId) => {
                    const r = getRoomById(roomId);
                    setNewEvent((prev) => ({
                      ...prev,
                      roomId,
                      roomName: r ? r.label : roomId,
                      location: r ? r.label : prev.location
                    }));
                  }}
                />
              )}

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
              <div>
                <label className="font-medium text-slate-700 block mb-1">
                  Senha Inicial de Acesso
                </label>
                <input 
                  type="text" 
                  required 
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Ex: renovaser123" 
                  className="w-full p-2 bg-slate-50 border rounded-lg focus:outline-none focus:border-emerald-500 font-mono text-xs" 
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  O profissional poderá alterar a senha ao realizar login.
                </p>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button 
                  type="button" 
                  disabled={isSubmitting}
                  onClick={() => setShowNewUserModal(false)} 
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Cadastrar Utilizador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ALTERAR SENHA DO USUÁRIO ATUAL */}
      {currentUser && (
        <ChangePasswordModal
          isOpen={showChangePasswordModal}
          onClose={() => setShowChangePasswordModal(false)}
          currentUser={currentUser}
          onPasswordChanged={(updatedUser) => {
            setCurrentUser(updatedUser);
            showNotification('Senha atualizada com sucesso!');
          }}
        />
      )}

    </div>
  );
}