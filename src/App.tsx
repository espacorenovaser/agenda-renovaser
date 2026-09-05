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
  logMeetingAction,
  getRecentMeetingLogs,
} from './lib/firestoreService';
import { getCurrentSaoPauloIso } from './lib/dateUtils';
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [prefilledInput, setPrefilledInput] = useState<string>('');

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
            'Olá! Sou a Agenda Interna do Instituto RenovaSer.\n\nEstou configurado no fuso horário America/Sao_Paulo (GMT-3) para organizar os agendamentos do instituto nas seguintes modalidades:\n\n• **Atendimentos**: 60 a 90 minutos com hora marcada na sala\n• **Reunião**: tempo definido conforme a necessidade\n• **Eventos**: Workshop, Treinamento, Formação e Transmissão on-line\n\nIdentifique-se com seu login (Admin ou Profissional) e conecte sua conta Google para sincronização.',
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
              }! Sou a Agenda Interna do Instituto RenovaSer.\n\nO que deseja agendar hoje?\n• **Atendimentos**: 60 a 90 minutos com hora marcada\n• **Reunião**: tempo definido conforme a necessidade\n• **Eventos**: Workshop, Treinamento, Formação ou Transmissão on-line\n\nBasta me dizer o que precisa ou clicar em uma das sugestões!`,
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
  // Professionals only see their own appointments (strictly isolated)
  const visibleEvents = React.useMemo(() => {
    if (!activeUser || activeUser.role === 'admin') {
      return events;
    }
    const profEmail = activeUser.email.toLowerCase();
    const profName = activeUser.name.toLowerCase();
    return events.filter((e) => {
      const inAttendees = e.attendees?.some((att) => att.toLowerCase().includes(profEmail));
      const inTitle = e.title?.toLowerCase().includes(profName);
      const inDesc =
        e.description?.toLowerCase().includes(profEmail) ||
        e.description?.toLowerCase().includes(profName);
      return inAttendees || inTitle || inDesc;
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
            content: '✅ Conta do Google Agenda conectada com sucesso! As permissões estão ativas e renovadas. Como posso te ajudar agora?',
            createdAt: new Date().toISOString(),
          },
        ]);
        fetchCalendarEvents();
      }
    } catch (err: any) {
      console.error('Erro de autenticação Google:', err);
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
    setEvents([]);
  };

  // Send message to Gemini Assistant
  const handleSendMessage = async (text: string) => {
    const token = accessToken || (await getAccessToken());
    if (!token) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'local-' + Date.now(),
          role: 'user',
          content: text,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'error-' + Date.now(),
          role: 'assistant',
          content:
            'Por favor, clique no botão "Entrar com Google" no topo da página para autorizar o acesso à sua agenda antes de solicitar agendamentos ou consultas.',
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }

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
      // Build short history for server context
      const historyContext = messages.slice(-8).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.content,
      }));

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          history: historyContext,
          nowIso: getCurrentSaoPauloIso(),
          activeUser: activeUser,
          registeredUsers: getRegisteredUsers(),
        }),
      });

      if (!res.ok) {
        let errMsg = 'Erro ao processar mensagem.';
        try {
          const errorData = await res.json();
          errMsg = errorData.error || errorData.text || errMsg;
        } catch {
          // Fallback
        }
        throw new Error(errMsg);
      }

      const data = await res.json();

      if (data.authExpired) {
        setIsTokenExpired(true);
      }

      // If AI executed a login tool or updated user profile
      if (data.activeUser) {
        handleActiveUserChanged(data.activeUser);
      }

      const assistantMsg: ChatMessage = {
        id: 'ast-' + Date.now(),
        role: 'assistant',
        content: data.text || 'Processado com sucesso.',
        createdAt: new Date().toISOString(),
        pendingActions: data.pendingActions,
        executedEvents: data.executedEvents,
        authExpired: data.authExpired,
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
          fetchCalendarEvents();
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

      let userText = `Ocorreu um erro ao comunicar com a agenda: ${err.message || 'Tente novamente.'}`;
      if (isHighDemand) {
        userText = 'O assistente de inteligência artificial está temporariamente sobrecarregado nos servidores. Por favor, aguarde alguns instantes e envie sua solicitação novamente.';
      } else if (isAuthError) {
        userText = 'Sua sessão com o Google Agenda expirou por segurança (validade padrão de 1 hora da Google). Clique no botão abaixo para reconectar sua conta com um clique.';
      }

      const errMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: userText,
        createdAt: new Date().toISOString(),
        isError: true,
        authExpired: isAuthError,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsChatLoading(false);
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
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {!user ? (
          /* Sign-in Callout Hero when not logged in - Natural Tones Deep Sage */
          <div className="mb-6 p-6 sm:p-8 rounded-2xl bg-[#455243] text-[#F7F5F0] border border-[#3A4538] shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2.5">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-[#556553] text-[#E8EFE9] border border-[#657963]">
                <Sparkles className="w-3.5 h-3.5 text-[#C4D9C2]" />
                <span>Instituto RenovaSer • Agenda Interna Oficial</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#FAF9F5]">
                Gestão integrada de atendimentos e eventos do instituto
              </h1>
              <p className="text-sm text-[#D7E2D5] max-w-2xl leading-relaxed">
                Conecte a conta do Google Agenda para sincronizar seus compromissos, verificar a disponibilidade da sala de atendimentos e gerar comunicados por e-mail com hora marcada (60 min).
              </p>
            </div>

            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="px-6 py-3 rounded-xl bg-[#FAF9F5] text-[#2E3029] hover:bg-white font-medium text-sm shadow-xs transition-all flex items-center space-x-3 shrink-0 disabled:opacity-60 cursor-pointer border border-[#DCD8CD]"
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
          </div>
        ) : null}

        {/* Dual Panel Layout: Chat Assistant (Left) & Live Calendar (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[600px]">
          {/* Chat Assistant Panel (7 cols on desktop) */}
          <div className="lg:col-span-7 flex flex-col h-[650px] lg:h-auto">
            <ChatAssistant
              messages={messages}
              isLoading={isChatLoading}
              onSendMessage={handleSendMessage}
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

          {/* Calendar Agenda Panel (5 cols on desktop) */}
          <div className="lg:col-span-5 flex flex-col h-[650px] lg:h-auto">
            <CalendarView
              events={visibleEvents}
              isLoading={isCalendarLoading}
              onRefresh={fetchCalendarEvents}
              onSelectSlotForAssistant={(prompt) => {
                setPrefilledInput(prompt);
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
        </div>
      </main>

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
    </div>
  );
}
