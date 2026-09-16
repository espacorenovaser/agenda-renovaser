import React, { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Video,
  Clock,
  ArrowRight,
  ExternalLink,
  HelpCircle,
  X,
} from 'lucide-react';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  setCachedToken,
} from './lib/firebase';
import {
  syncUserProfile,
  saveChatMessage,
  subscribeToMessages,
  clearChatMessages,
  logMeetingAction,
  getRecentMeetingLogs,
} from './lib/firestoreService';
import { getCurrentSaoPauloIso } from './lib/dateUtils';
import { getSampleEvents } from './lib/sampleEvents';
import type { CalendarEvent, ChatMessage, PendingAction, MeetingAuditLog, AppUser } from './types';
import {
  getActiveUser,
  setActiveUser as persistActiveUser,
  INITIAL_ADMINS,
  getRegisteredUsers,
} from './lib/renovaserAuth';
import { Navbar } from './components/Navbar';
import { CalendarView } from './components/CalendarView';
import { ChatAssistant } from './components/ChatAssistant';
import { ConfirmationModal } from './components/ConfirmationModal';
import { MeetingHistoryModal } from './components/MeetingHistoryModal';
import { RenovaserAuthModal } from './components/RenovaserAuthModal';
import { AuthHelpModal } from './components/AuthHelpModal';

export default function App() {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>(() => getSampleEvents());
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [prefilledInput, setPrefilledInput] = useState<string>('');
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [selectedProfessionalEmail, setSelectedProfessionalEmail] = useState<string | 'all'>('all');

  // Auth Error / Help Modal state
  const [authErrorModal, setAuthErrorModal] = useState<{
    title: string;
    message: string;
    code?: string;
    isIframe?: boolean;
    details?: string;
  } | null>(null);

  // Instituto RenovaSer Active User State (Admins: Claudir, Cleci, Gorete or Professional)
  const [activeUser, setActiveUserState] = useState<AppUser | null>(() => {
    return getActiveUser() || INITIAL_ADMINS[0];
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleActiveUserChanged = (newUser: AppUser | null) => {
    setActiveUserState(newUser);
    persistActiveUser(newUser);
  };

  // Confirmation modal state for destructive actions (Workspace Security Requirement)
  const [activePendingAction, setActivePendingAction] = useState<PendingAction | null>(null);
  const [isActionExecuting, setIsActionExecuting] = useState(false);

  // History modal state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<MeetingAuditLog[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [isTokenExpired, setIsTokenExpired] = useState(false);

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessTokenState(token);
        setIsTokenExpired(!token);
        syncUserProfile(currentUser);
      },
      () => {
        setUser(null);
        setAccessTokenState(null);
        setIsTokenExpired(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch Calendar events
  const fetchCalendarEvents = useCallback(async () => {
    const token = accessToken || (await getAccessToken());
    if (!token) return;

    setIsCalendarLoading(true);
    try {
      // Look from start of today to 7 days ahead
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const timeMin = now.toISOString();
      const future = new Date();
      future.setDate(future.getDate() + 14);
      const timeMax = future.toISOString();

      const res = await fetch(`/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setIsTokenExpired(false);
        const data = await res.json();
        const rawItems = data.items || [];
        const parsed: CalendarEvent[] = rawItems.map((item: any) => ({
          id: item.id,
          title: item.summary || '(Sem título)',
          start: item.start?.dateTime || item.start?.date,
          end: item.end?.dateTime || item.end?.date,
          attendees: item.attendees?.map((a: any) => a.email) || [],
          meetLink: item.hangoutLink || null,
          htmlLink: item.htmlLink,
          description: item.description || '',
          location: item.location || '',
        }));
        setEvents(parsed);
      } else {
        if (res.status === 401) {
          setIsTokenExpired(true);
        }
        console.warn('Erro ao listar eventos do Google Calendar:', res.statusText);
      }
    } catch (error) {
      console.error('Falha ao carregar eventos:', error);
    } finally {
      setIsCalendarLoading(false);
    }
  }, [accessToken]);

  // When access token changes, load events
  useEffect(() => {
    if (accessToken) {
      fetchCalendarEvents();
    }
  }, [accessToken, fetchCalendarEvents]);

  // Subscribe to persistent Firestore chat messages
  useEffect(() => {
    if (!user) {
      // Default welcome message when offline / not signed in
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            'Olá! Sou a Agenda Interna do Instituto RenovaSer.\n\nEstou configurado no fuso horário America/Sao_Paulo (GMT-3) para organizar os agendamentos do instituto nas seguintes modalidades:\n\n• **Atendimentos**: com hora marcada na sala\n• **Reunião**: tempo definido conforme a necessidade\n• **Eventos**: Workshop, Treinamento, Formação e Transmissão on-line\n\nIdentifique-se com seu login (Admin ou Profissional) e conecte sua conta Google para sincronização.',
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }

    const unsub = subscribeToMessages(
      user.uid,
      (firestoreMsgs) => {
        if (firestoreMsgs.length > 0) {
          setMessages(firestoreMsgs);
        } else {
          setMessages([
            {
              id: 'welcome-auth',
              role: 'assistant',
              content: `Olá, ${
                user.displayName || activeUser?.name || 'colega'
              }! Sou a Agenda Interna do Instituto RenovaSer.\n\nO que deseja agendar hoje?\n• **Atendimentos**: com hora marcada na sala\n• **Reunião**: tempo definido conforme a necessidade\n• **Eventos**: Workshop, Treinamento, Formação ou Transmissão on-line\n\nBasta me dizer o que precisa ou clicar em uma das sugestões!`,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      },
      (err) => console.error('Erro ao assinar mensagens:', err)
    );

    return () => unsub();
  }, [user, activeUser]);

  // Filter events based on active user role:
  // Admins (Claudir, Cleci, Gorete) see all events;
  // Professionals only see their own appointments (strictly isolated) + general institute events
  const visibleEvents = React.useMemo(() => {
    if (!activeUser || activeUser.role === 'admin') {
      return events;
    }
    const profEmail = activeUser.email.toLowerCase();
    const profName = activeUser.name.toLowerCase();
    return events.filter((e) => {
      // General institutional events are visible to all professionals
      if (e.category === 'evento' || e.title?.toLowerCase().includes('[evento')) {
        return true;
      }
      const inAttendees = e.attendees?.some((att) => att.toLowerCase().includes(profEmail));
      const inTitle = e.title?.toLowerCase().includes(profName);
      const inDesc =
        e.description?.toLowerCase().includes(profEmail) ||
        e.description?.toLowerCase().includes(profName);
      const isOwner =
        (e as any).professionalEmail?.toLowerCase() === profEmail ||
        (e as any).professionalName?.toLowerCase().includes(profName);
      return inAttendees || inTitle || inDesc || isOwner;
    });
  }, [events, activeUser]);

  // Login / Reconnect Handler
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessTokenState(result.accessToken);
        setIsTokenExpired(false);
        setIsDemoMode(false);
        try {
          await syncUserProfile(result.user);
        } catch (profileErr) {
          console.warn('Perfil será sincronizado posteriormente:', profileErr);
        }

        // Add feedback message when reconnecting
        setMessages((prev) => [
          ...prev,
          {
            id: 'reconnect-' + Date.now(),
            role: 'assistant',
            content: '✅ Conta do Google Agenda conectada com sucesso! As permissões estão ativas e sincronizadas. Como posso te ajudar agora?',
            createdAt: new Date().toISOString(),
          },
        ]);
        fetchCalendarEvents();
      }
    } catch (err: any) {
      console.error('Erro de autenticação Google:', err);
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      const code = err?.code || '';
      const msg = String(err?.message || err || '');

      let title = 'Não foi possível conectar com o Google';
      let message = 'Ocorreu um erro ao abrir a conexão da conta Google.';

      if (code === 'auth/popup-blocked' || msg.toLowerCase().includes('popup') || msg.toLowerCase().includes('blocked')) {
        title = 'Janela de Login Bloqueada pelo Navegador';
        message = isIframe
          ? 'O navegador bloqueou a janela pop-up de login porque o aplicativo está sendo executado no preview embutido (iframe) do AI Studio. Para conectar com sua conta Google, abra o aplicativo em uma Nova Aba.'
          : 'O navegador bloqueou a janela pop-up de login do Google. Por favor, permita pop-ups para este endereço nas configurações do seu navegador e tente novamente.';
      } else if (code === 'auth/unauthorized-domain' || msg.toLowerCase().includes('unauthorized domain')) {
        title = 'Domínio Não Autorizado no Firebase Auth';
        message = `O endereço atual (${window.location.hostname}) precisa ser adicionado na lista de Domínios Autorizados no Firebase Authentication. No seu domínio próprio (agenda.institutorenovaser.com.br) funcionará normalmente assim que ativado no painel do Firebase.`;
      } else if (code === 'auth/popup-closed-by-user') {
        title = 'Conexão Cancelada';
        message = 'A janela do Google foi fechada antes de concluir a autorização da agenda.';
      } else if (code === 'auth/cancelled-popup-request') {
        title = 'Requisição Concorrente';
        message = 'Uma solicitação de conexão já estava em andamento.';
      } else if (isIframe) {
        title = 'Restrição de Login no Preview';
        message = 'Por segurança contra rastreamento, o Google e os navegadores bloqueiam pop-ups de autenticação dentro de quadros embutidos (iframes). Clique em "Abrir em Nova Aba" para autenticar.';
      } else {
        message = `${msg} (${code || 'sem código'}).`;
      }

      setAuthErrorModal({
        title,
        message,
        code,
        isIframe,
        details: msg,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessTokenState(null);
    setIsTokenExpired(false);
    setIsDemoMode(true);
    setEvents(getSampleEvents());
  };

  // Send message to Gemini Assistant
  const handleSendMessage = async (text: string) => {
    const token = accessToken || (await getAccessToken());

    const userMessage: ChatMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    // Optimistically update UI
    setMessages((prev) => [...prev, userMessage]);
    setIsChatLoading(true);

    if (user) {
      saveChatMessage(user.uid, {
        role: 'user',
        content: text,
        createdAt: userMessage.createdAt,
      });
    }

    try {
      // Build short history for server context (filter out error messages and empty lines)
      const historyContext = messages
        .filter((m) => !m.isError && m.content && m.content.trim())
        .slice(-8)
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          text: m.content,
        }));

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          history: historyContext,
          nowIso: getCurrentSaoPauloIso(),
          activeUser: activeUser,
          registeredUsers: getRegisteredUsers(),
          currentEvents: events,
        }),
      });

      if (!res.ok) {
        let errMsg = '';
        try {
          const errorData = await res.json();
          const raw = errorData.error || errorData.message || errorData.text;
          if (typeof raw === 'string') {
            errMsg = raw;
          } else if (raw && typeof raw === 'object' && raw.message) {
            errMsg = raw.message;
          }
        } catch {
          // JSON parse failed
        }

        if (!errMsg) {
          const rawText = await res.text().catch(() => '');
          if (rawText && rawText.length < 300 && !rawText.includes('<!DOCTYPE') && !rawText.includes('<html')) {
            errMsg = rawText;
          } else if (res.status === 503) {
            errMsg = 'O serviço de inteligência artificial está com alta demanda momentânea nos servidores da Google. Por favor, tente novamente em alguns instantes.';
          } else {
            errMsg = `Falha temporária de comunicação com o servidor (${res.status}). Por favor, clique em "Tentar novamente" abaixo.`;
          }
        }
        throw new Error(errMsg);
      }

      let data: any;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const raw = await res.text();
        throw new Error(`Resposta inesperada do servidor: ${raw.slice(0, 120)}`);
      }

      if (data.authExpired) {
        setIsTokenExpired(true);
      }

      // If AI executed a login tool or updated user profile
      if (data.activeUser) {
        handleActiveUserChanged(data.activeUser);
      }

      // If new events were created by the assistant, update local calendar state immediately
      if (data.executedEvents && data.executedEvents.length > 0) {
        setEvents((prev) => [
          ...data.executedEvents,
          ...prev.filter((p) => !data.executedEvents.some((e: any) => e.id === p.id)),
        ]);
      }

      const assistantMsg: ChatMessage = {
        id: 'ast-' + Date.now(),
        role: 'assistant',
        content: data.text || 'Processado com sucesso.',
        createdAt: new Date().toISOString(),
        pendingActions: data.pendingActions,
        executedEvents: data.executedEvents,
        authExpired: data.authExpired || (!token && (data.text?.includes('conectar') || data.text?.includes('Google Agenda'))),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (user) {
        saveChatMessage(user.uid, {
          role: 'assistant',
          content: assistantMsg.content,
          createdAt: assistantMsg.createdAt,
          pendingActions: data.pendingActions,
          executedEvents: data.executedEvents,
          authExpired: data.authExpired,
        });

        // Audit executed events in Firestore
        if (data.executedEvents && data.executedEvents.length > 0) {
          for (const ev of data.executedEvents) {
            await logMeetingAction(user.uid, {
              eventId: ev.id,
              title: ev.title,
              startDateTime: ev.start,
              endDateTime: ev.end,
              action: 'created',
            });
          }
          if (token) {
            fetchCalendarEvents();
          }
        }
      }

      // If there is a pending confirmation action, trigger modal for convenience
      if (data.pendingActions && data.pendingActions.length > 0) {
        setActivePendingAction(data.pendingActions[0]);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const msg = String(err?.message || err);
      const isHighDemand =
        msg.includes('alta demanda') ||
        msg.includes('503') ||
        msg.includes('high demand') ||
        msg.includes('UNAVAILABLE');
      const isAuthError =
        msg.includes('TOKEN_EXPIRED') ||
        msg.includes('Unauthorized') ||
        msg.includes('401') ||
        msg.includes('falha de autorização');

      if (isAuthError) {
        setIsTokenExpired(true);
      }

      let userText = err.message || 'Erro temporário na comunicação com o assistente.';
      if (isHighDemand) {
        userText = 'O assistente de inteligência artificial está temporariamente sobrecarregado nos servidores da Google. Por favor, clique em "Tentar novamente" abaixo ou adicione a chave OPENAI_API_KEY no painel para contingência automática.';
      } else if (isAuthError) {
        userText = 'Sua sessão com o Google Agenda expirou por segurança (validade padrão de 1 hora da Google). Clique no botão abaixo para reconectar sua conta com um clique.';
      }

      const errMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: userText,
        createdAt: new Date().toISOString(),
        isError: true,
        retryText: text,
        authExpired: isAuthError,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Clear chat conversation history
  const handleClearChat = async () => {
    const welcomeMsg: ChatMessage = {
      id: 'welcome-' + Date.now(),
      role: 'assistant',
      content: user
        ? `Olá, ${user.displayName || activeUser?.name || 'colega'}! Sou a Agenda Interna do Instituto RenovaSer.\n\nO histórico do chat foi limpo. O que deseja agendar?\n• **Atendimentos**: com hora marcada na sala\n• **Reunião**: tempo flexível conforme necessidade\n• **Eventos**: Workshop, Treinamento, Formação ou Transmissão on-line\n• **Comunicação**: informe ou aviso oficial da equipe`
        : 'Olá! Sou a Agenda Interna do Instituto RenovaSer.\n\nO histórico do chat foi limpo. Em que posso ajudar você hoje?',
      createdAt: new Date().toISOString(),
    };

    setMessages([welcomeMsg]);

    if (user) {
      try {
        await clearChatMessages(user.uid);
      } catch (e) {
        console.warn('Erro ao limpar mensagens no Firestore:', e);
      }
    }
  };

  // User confirms destructive action (cancel or update)
  const handleConfirmAction = async (action: PendingAction) => {
    const token = accessToken || (await getAccessToken());
    if (!token) return;

    setIsActionExecuting(true);
    try {
      if (action.type === 'requestEventCancellation') {
        const res = await fetch('/api/calendar/execute-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ eventId: action.args.eventId }),
        });

        if (!res.ok) throw new Error('Falha ao excluir evento da agenda.');

        if (user) {
          await logMeetingAction(user.uid, {
            eventId: action.args.eventId,
            title: action.args.eventTitle,
            startDateTime: action.args.startDateTime,
            action: 'cancelled',
          });
        }

        const notifyMsg: ChatMessage = {
          id: 'del-' + Date.now(),
          role: 'assistant',
          content: `A reunião **"${action.args.eventTitle}"** foi cancelada com sucesso no Google Calendar e removida da agenda.`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, notifyMsg]);
        if (user) {
          saveChatMessage(user.uid, {
            role: 'assistant',
            content: notifyMsg.content,
            createdAt: notifyMsg.createdAt,
          });
        }
      } else if (action.type === 'requestEventUpdate') {
        const updates: any = {};
        if (action.args.newTitle) updates.summary = action.args.newTitle;
        if (action.args.newStartDateTime) {
          updates.start = { dateTime: action.args.newStartDateTime, timeZone: 'America/Sao_Paulo' };
        }
        if (action.args.newEndDateTime) {
          updates.end = { dateTime: action.args.newEndDateTime, timeZone: 'America/Sao_Paulo' };
        }

        const res = await fetch('/api/calendar/execute-update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ eventId: action.args.eventId, updates }),
        });

        if (!res.ok) throw new Error('Falha ao atualizar evento da agenda.');

        if (user) {
          await logMeetingAction(user.uid, {
            eventId: action.args.eventId,
            title: action.args.newTitle || action.args.eventTitle,
            startDateTime: action.args.newStartDateTime || action.args.startDateTime,
            action: 'updated',
          });
        }

        const notifyMsg: ChatMessage = {
          id: 'upd-' + Date.now(),
          role: 'assistant',
          content: `A reunião **"${action.args.newTitle || action.args.eventTitle}"** foi atualizada com sucesso no Google Calendar!`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, notifyMsg]);
        if (user) {
          saveChatMessage(user.uid, {
            role: 'assistant',
            content: notifyMsg.content,
            createdAt: notifyMsg.createdAt,
          });
        }
      }

      setActivePendingAction(null);
      fetchCalendarEvents();
    } catch (err: any) {
      console.error('Error confirming action:', err);
      alert(`Erro: ${err.message}`);
    } finally {
      setIsActionExecuting(false);
    }
  };

  // Load audit logs
  const handleOpenHistory = async () => {
    setIsHistoryOpen(true);
    if (!user) return;
    setIsLogsLoading(true);
    try {
      const logs = await getRecentMeetingLogs(user.uid);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setIsLogsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#4A4A43] flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoggingIn={isLoggingIn}
        onOpenHistory={handleOpenHistory}
        calendarConnected={!!accessToken && !isTokenExpired}
        activeUser={activeUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        isInIframe={isInIframe}
        onOpenChat={() => setIsChatOpen(true)}
        onOpenAuthHelp={() =>
          setAuthErrorModal({
            title: 'Conexão com o Google Calendar',
            message: isInIframe
              ? 'Você está no ambiente de pré-visualização (iframe) do AI Studio. Por questões de segurança, os navegadores impedem popups de login aqui. Abra o aplicativo em uma Nova Aba para conectar com a conta do Google.'
              : 'Clique em "Conectar Google Agenda" para autorizar a sincronização oficial de eventos.',
            isIframe: isInIframe,
          })
        }
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {!user ? (
          /* Sign-in Callout Hero when not logged in - Clean Modern Emerald */
          <div className="mb-6 p-6 sm:p-8 rounded-2xl bg-emerald-900 text-white border border-emerald-950 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2.5">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-800 text-emerald-100 border border-emerald-700">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                <span>Instituto RenovaSer • Agenda Interna Oficial</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Gestão integrada de atendimentos e eventos do instituto
              </h1>
              <p className="text-sm text-emerald-100 max-w-2xl leading-relaxed">
                Conecte a conta do Google Agenda para sincronizar seus compromissos, verificar a disponibilidade da sala de atendimentos e agendar com hora marcada.
              </p>
              {isDemoMode && (
                <div className="inline-flex items-center space-x-1.5 text-xs text-emerald-200 bg-emerald-950/70 px-3 py-1 rounded-xl border border-emerald-800">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Modo Demonstração ativo: agenda e assistente liberados para teste!</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0 w-full md:w-auto">
              <button
                id="btn-hero-google-login"
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-50 font-bold text-sm shadow-xs transition-all flex items-center justify-center space-x-3 shrink-0 disabled:opacity-60 cursor-pointer border border-slate-200"
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>{isLoggingIn ? 'Conectando...' : 'Conectar Google Agenda'}</span>
              </button>

              {/* If inside iframe, offer open in new tab button */}
              {isInIframe && (
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center space-x-2 border border-emerald-700 cursor-pointer"
                  title="Abrir em Nova Aba para conectar com Google sem restrições de pop-up do iframe"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir em Nova Aba</span>
                </a>
              )}

              <button
                type="button"
                onClick={() =>
                  setAuthErrorModal({
                    title: 'Como conectar a sua Google Agenda',
                    message: isInIframe
                      ? 'No preview do AI Studio, o navegador bloqueia pop-ups dentro de iframes. Abra o app em Nova Aba para fazer login direto, ou teste livremente o assistente e a agenda no Modo Demonstração.'
                      : 'O login utiliza sua conta do Google para ler e agendar compromissos no Google Calendar do Instituto RenovaSer.',
                    isIframe: isInIframe,
                  })
                }
                className="p-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-emerald-100 hover:text-white transition-colors flex items-center justify-center cursor-pointer border border-emerald-700"
                title="Ajuda sobre a conexão"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Full-width Calendar Agenda View */}
        <div className="flex-1 flex flex-col min-h-[600px]">
          <CalendarView
            events={visibleEvents}
            isLoading={isCalendarLoading}
            onRefresh={fetchCalendarEvents}
            isDemoMode={isDemoMode && !accessToken}
            selectedProfessionalEmail={selectedProfessionalEmail}
            onSelectProfessional={(prof) => setSelectedProfessionalEmail(prof ? prof.email : 'all')}
            onOpenChat={() => setIsChatOpen(true)}
            activeUser={activeUser}
            onSelectSlotForAssistant={(prompt) => {
              setPrefilledInput(prompt);
              setIsChatOpen(true);
            }}
            onRequestCancel={(event) => {
              setActivePendingAction({
                type: 'requestEventCancellation',
                args: {
                  eventId: event.id,
                  eventTitle: event.title,
                  startDateTime: event.start,
                },
              });
            }}
          />
        </div>

        {/* Floating Action Button (FAB) to open chat when hidden */}
        {!isChatOpen && (
          <button
            id="fab-register-schedule"
            type="button"
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-6 right-6 z-30 px-4 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-xl hover:shadow-2xl border border-emerald-800 flex items-center space-x-3 transition-all cursor-pointer group"
            title="Clique para registrar horário na agenda com o assistente inteligente"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-800 text-emerald-200 flex items-center justify-center shadow-2xs group-hover:scale-110 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold leading-tight">Registrar Horário</div>
              <div className="text-[10px] text-emerald-200 leading-tight">Assistente da Agenda</div>
            </div>
          </button>
        )}
      </main>

      {/* Slide-over Assistant Drawer / Modal */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsChatOpen(false)}
            title="Clique para fechar o assistente e voltar para a agenda"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-3 sm:pl-10">
            <div className="w-screen max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-250">
              {/* Drawer Header */}
              <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 shadow-2xs">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                    <Sparkles className="w-5 h-5 text-emerald-200" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        Assistente de Agendamento
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                        Instituto RenovaSer
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Conectado como: <strong>{activeUser?.name || 'Administrador'}</strong> (
                      {activeUser?.role === 'admin'
                        ? 'Acesso Total'
                        : activeUser?.specialty || 'Profissional'}
                      )
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    id="btn-close-assistant-drawer"
                    type="button"
                    onClick={() => setIsChatOpen(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer flex items-center space-x-1"
                    title="Fechar Assistente e voltar para a agenda"
                  >
                    <X className="w-5 h-5" />
                    <span className="text-xs font-bold hidden sm:inline">Fechar</span>
                  </button>
                </div>
              </div>

              {/* Drawer Body: ChatAssistant */}
              <div className="flex-1 overflow-hidden p-3 sm:p-5 flex flex-col bg-slate-50/50">
                <ChatAssistant
                  messages={messages}
                  isLoading={isChatLoading}
                  onSendMessage={handleSendMessage}
                  onClearChat={handleClearChat}
                  onConfirmPendingAction={(action) => {
                    setActivePendingAction(action);
                  }}
                  prefilledInput={prefilledInput}
                  setPrefilledInput={setPrefilledInput}
                  onReconnect={handleLogin}
                  isTokenExpired={isTokenExpired}
                  activeUser={activeUser}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Destructive/Mutating Operations */}
      <ConfirmationModal
        action={activePendingAction}
        isOpen={!!activePendingAction}
        onClose={() => setActivePendingAction(null)}
        onConfirm={handleConfirmAction}
        isLoading={isActionExecuting}
      />

      {/* Persistent History / Audit Modal */}
      <MeetingHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        logs={auditLogs}
        isLoading={isLogsLoading}
      />

      {/* Renovaser Auth & Professional Management Modal */}
      <RenovaserAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        activeUser={activeUser}
        onUserChanged={handleActiveUserChanged}
      />

      {/* Auth Help & Iframe Resolution Modal */}
      <AuthHelpModal
        isOpen={!!authErrorModal}
        onClose={() => setAuthErrorModal(null)}
        title={authErrorModal?.title || 'Conexão com Google Agenda'}
        message={authErrorModal?.message || ''}
        code={authErrorModal?.code}
        isIframe={authErrorModal?.isIframe ?? isInIframe}
        details={authErrorModal?.details}
        onActivateDemoMode={() => {
          setIsDemoMode(true);
          setEvents(getSampleEvents());
        }}
      />
    </div>
  );
}
