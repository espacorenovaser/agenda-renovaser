import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  Video,
  Clock,
  CalendarCheck,
  AlertTriangle,
  Users,
  CheckCircle,
  Loader2,
  RefreshCw,
  KeyRound,
  Copy,
  Check,
  CalendarPlus,
  Mail,
  Shield,
  Briefcase,
  Tag,
  Trash2,
  ChevronDown,
  UserCheck,
  Zap,
} from 'lucide-react';
import type { ChatMessage, PendingAction, AppUser } from '../types';
import { formatDateTimeBR, formatTimeBR } from '../lib/dateUtils';
import { getRegisteredUsers, type AppUserWithAuth } from '../lib/renovaserAuth';

interface ChatAssistantProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => Promise<void>;
  onRetryMessage?: (text: string, errorId: string) => Promise<void> | void;
  onClearChat?: () => void;
  onConfirmPendingAction: (action: PendingAction) => Promise<void>;
  prefilledInput: string;
  setPrefilledInput: (val: string) => void;
  onReconnect?: () => void;
  isTokenExpired?: boolean;
  activeUser?: AppUser | null;
  onOpenAuthModal?: () => void;
  onCancelLoading?: () => void;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onRetryMessage,
  onClearChat,
  onConfirmPendingAction,
  prefilledInput,
  setPrefilledInput,
  onReconnect,
  isTokenExpired,
  activeUser,
  onOpenAuthModal,
  onCancelLoading,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [therapists, setTherapists] = useState<AppUserWithAuth[]>([]);
  const [selectedTherapistEmails, setSelectedTherapistEmails] = useState<string[]>([]);
  const [isAllTherapistsSelected, setIsAllTherapistsSelected] = useState<boolean>(true);
  const [showParticipantSelector, setShowParticipantSelector] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load therapists list
  useEffect(() => {
    try {
      const allUsers = getRegisteredUsers();
      const profs = allUsers.filter((u) => u.role === 'professional');
      setTherapists(profs);
      setSelectedTherapistEmails(profs.map((p) => p.email.toLowerCase()));
    } catch {
      // Fallback
    }
  }, []);

  const handleToggleAllTherapists = () => {
    if (isAllTherapistsSelected) {
      setIsAllTherapistsSelected(false);
      setSelectedTherapistEmails([]);
    } else {
      setIsAllTherapistsSelected(true);
      setSelectedTherapistEmails(therapists.map((t) => t.email.toLowerCase()));
    }
  };

  const handleToggleSingleTherapist = (email: string) => {
    const norm = email.toLowerCase();
    if (isAllTherapistsSelected) {
      setIsAllTherapistsSelected(false);
      setSelectedTherapistEmails([norm]);
    } else {
      let updated: string[];
      if (selectedTherapistEmails.includes(norm)) {
        updated = selectedTherapistEmails.filter((e) => e !== norm);
      } else {
        updated = [...selectedTherapistEmails, norm];
      }
      setSelectedTherapistEmails(updated);
      if (updated.length === therapists.length && therapists.length > 0) {
        setIsAllTherapistsSelected(true);
      }
    }
  };

  const handleInsertMeetingPrompt = (timeStr: string = 'Hoje às 19h30') => {
    let participantDesc = '';
    if (
      isAllTherapistsSelected ||
      selectedTherapistEmails.length === 0 ||
      selectedTherapistEmails.length === therapists.length
    ) {
      participantDesc = 'equipe de terapeutas';
    } else {
      const selectedObjs = therapists.filter((t) =>
        selectedTherapistEmails.includes(t.email.toLowerCase())
      );
      participantDesc =
        selectedObjs.length > 0
          ? selectedObjs.map((t) => t.name).join(' e ')
          : 'equipe de terapeutas';
    }

    const prompt = `Gostaria de agendar uma Reunião com tempo definido conforme a necessidade. ${timeStr}, com ${participantDesc}.`;
    setInputText(prompt);
    textareaRef.current?.focus();
  };

  // Sync prefilledInput if provided
  useEffect(() => {
    if (prefilledInput) {
      setInputText(prefilledInput);
      setPrefilledInput('');
      textareaRef.current?.focus();
    }
  }, [prefilledInput, setPrefilledInput]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea to provide generous, comfortable composition space
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.max(85, Math.min(scrollHeight, 260))}px`;
    }
  }, [inputText]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '85px';
    }
    onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleQuickSchedulePrompt = (category: string) => {
    if (category === 'reuniao') {
      setShowParticipantSelector(true);
      handleInsertMeetingPrompt('Hoje às 19h30');
      return;
    }
    let prompt = '';
    if (category === 'atendimento') {
      prompt = 'Gostaria de agendar um atendimento na sala do Instituto RenovaSer.';
    } else if (category === 'comunicacao') {
      prompt = 'Gostaria de registrar uma comunicação/aviso oficial para a equipe do Instituto RenovaSer.';
    } else if (category === 'workshop') {
      prompt = 'Gostaria de cadastrar um evento do tipo Workshop no Instituto RenovaSer.';
    } else if (category === 'treinamento') {
      prompt = 'Gostaria de agendar um evento do tipo Treinamento no Instituto RenovaSer.';
    } else if (category === 'formacao') {
      prompt = 'Gostaria de cadastrar um evento do tipo Formação no Instituto RenovaSer.';
    } else if (category === 'transmissao_online') {
      prompt = 'Gostaria de agendar uma transmissão on-line com link do Google Meet no Instituto RenovaSer.';
    }
    setInputText(prompt);
    textareaRef.current?.focus();
  };

  return (
    <div id="chat-assistant-container" className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Assistant Header */}
      <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
              <span>Assistente da Agenda</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h2>
            <p className="text-xs text-slate-500">
              {activeUser ? (
                <span className="flex items-center space-x-1">
                  <span>Conectado como:</span>
                  <strong className="text-slate-800">{activeUser.name}</strong>
                  <span className="text-slate-400">
                    ({activeUser.role === 'admin' ? 'Administrador' : activeUser.specialty || 'Profissional'})
                  </span>
                </span>
              ) : (
                'Atendimentos com hora marcada, eventos e comunicados'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onClearChat && (
            showClearConfirm ? (
              <div className="flex items-center space-x-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg animate-in fade-in duration-150">
                <span className="text-[11px] text-rose-700 font-medium">Limpar tudo?</span>
                <button
                  id="btn-confirm-clear-chat"
                  type="button"
                  onClick={() => {
                    setShowClearConfirm(false);
                    onClearChat();
                  }}
                  className="text-[11px] px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded transition-colors cursor-pointer"
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="text-[11px] px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded transition-colors cursor-pointer"
                >
                  Não
                </button>
              </div>
            ) : (
              <button
                id="btn-open-clear-chat"
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-700 font-medium transition-colors cursor-pointer flex items-center space-x-1 shadow-2xs"
                title="Limpar o histórico de conversas do assistente"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar Chat</span>
              </button>
            )
          )}

          {onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition-colors cursor-pointer flex items-center space-x-1 shadow-2xs"
            >
              {activeUser?.role === 'admin' ? (
                <Shield className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <Briefcase className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{activeUser ? 'Trocar Acesso' : 'Identificar-se'}</span>
            </button>
          )}

          <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
            GMT-3 (SP)
          </div>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          // Check if message contains an email comunicado
          const hasEmailNotice = msg.content.includes('--- COMUNICADO POR E-MAIL ---');
          let noticeBlock = '';
          if (hasEmailNotice) {
            const parts = msg.content.split('--- COMUNICADO POR E-MAIL ---');
            if (parts[1]) {
              const noticeParts = parts[1].split('-----------------------------');
              noticeBlock = (noticeParts[0] || '').trim();
            }
          }

          // Check if message contains a Google Calendar URL
          const gcalUrlMatch = msg.content.match(/https:\/\/calendar\.google\.com\/calendar\/render[^\s)\]]+/);
          const gcalUrl = gcalUrlMatch ? gcalUrlMatch[0] : null;

          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold ${
                  isUser
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : msg.isError
                    ? 'bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs'
                    : 'bg-white text-emerald-700 border border-slate-200 shadow-2xs'
                }`}
              >
                {isUser ? (
                  <UserIcon className="w-4 h-4" />
                ) : msg.isError ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-emerald-700 text-white rounded-tr-xs shadow-xs'
                    : msg.isError
                    ? 'bg-rose-50 text-rose-950 rounded-tl-xs border border-rose-200 shadow-xs'
                    : 'bg-white text-slate-800 rounded-tl-xs border border-slate-200 shadow-xs'
                }`}
              >
                {/* Text Content with formatted lines */}
                <div className="whitespace-pre-wrap font-sans text-sm space-y-1">
                  {msg.content.split('\n').map((line, idx) => {
                    const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
                    if (isBullet) {
                      return (
                        <div key={idx} className="flex items-start space-x-2 pl-1 py-0.5">
                          <span className={isUser ? 'text-emerald-200' : 'text-emerald-600'}>•</span>
                          <span className="flex-1">{line.replace(/^[-•]\s*/, '')}</span>
                        </div>
                      );
                    }
                    return <p key={idx}>{line}</p>;
                  })}
                </div>

                {/* Formatted Email Notice Card (with one-click Copy) */}
                {noticeBlock && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-emerald-200 shadow-xs text-xs text-slate-900">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2">
                      <span className="font-bold text-emerald-800 flex items-center space-x-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        <span>Comunicado por E-mail Oficial</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleCopyText(noticeBlock, `notice-${msg.id}`)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg font-bold border border-slate-200 transition-colors cursor-pointer"
                      >
                        {copiedId === `notice-${msg.id}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar E-mail</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="font-mono text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                      {noticeBlock}
                    </pre>
                  </div>
                )}

                {/* Google Calendar Direct Add Button */}
                {gcalUrl && (
                  <div className="mt-3">
                    <a
                      href={gcalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>Adicionar ao Google Agenda Oficial</span>
                    </a>
                  </div>
                )}

                {/* Executed Calendar Event Card (if created in this turn) */}
                {msg.executedEvents && msg.executedEvents.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.executedEvents.map((ev, i) => (
                      <div
                        key={i}
                        className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-slate-800 text-xs shadow-2xs"
                      >
                        <div className="flex items-center space-x-2 text-emerald-800 font-bold mb-1">
                          <CalendarCheck className="w-4 h-4 text-emerald-600" />
                          <span>
                            {ev.category === 'reuniao'
                              ? 'Reunião confirmada na agenda!'
                              : ev.category === 'evento'
                              ? 'Evento confirmado na agenda!'
                              : ev.category === 'comunicacao'
                              ? 'Comunicado registrado!'
                              : 'Atendimento confirmado na agenda!'}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 text-sm">{ev.title}</p>
                        <p className="text-slate-600 mt-1 flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-700" />
                          <span className="font-semibold text-slate-800">
                            {formatDateTimeBR(ev.start)} – {formatTimeBR(ev.end)}
                          </span>
                        </p>

                        {ev.attendees && ev.attendees.length > 0 && (
                          <p className="text-slate-600 mt-1 flex items-center space-x-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>Participantes: {ev.attendees.join(', ')}</span>
                          </p>
                        )}

                        <div className="mt-2.5 pt-2 border-t border-emerald-200 flex flex-wrap gap-2">
                          {ev.meetLink && (
                            <a
                              href={ev.meetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs transition-colors"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Entrar com Google Meet</span>
                            </a>
                          )}

                          {ev.googleCalendarUrl && (
                            <a
                              href={ev.googleCalendarUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs transition-colors"
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                              <span>Link Direto Google Agenda</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending Actions for User Confirmation */}
                {msg.pendingActions && msg.pendingActions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.pendingActions.map((action, i) => {
                      const isDel = action.type === 'requestEventCancellation';
                      return (
                        <div
                          key={i}
                          className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-slate-800 text-xs shadow-2xs"
                        >
                          <div className="flex items-center space-x-1.5 text-amber-900 font-bold mb-1">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <span>
                              {isDel
                                ? 'Confirmação necessária para cancelamento'
                                : 'Confirmação necessária para reagendamento'}
                            </span>
                          </div>
                          <p className="text-slate-800">
                            Evento: <strong className="text-slate-950">{action.args.eventTitle}</strong>
                          </p>
                          {action.args.newStartDateTime && (
                            <p className="text-slate-800 mt-0.5">
                              Novo Horário: <strong className="text-slate-950">{formatDateTimeBR(action.args.newStartDateTime)}</strong>
                            </p>
                          )}

                          <div className="mt-2.5 flex space-x-2">
                            <button
                              onClick={() => onConfirmPendingAction(action)}
                              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Confirmar</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* One-click Google Agenda Reconnection Button */}
                {onReconnect && (msg.authExpired || msg.content.includes('Unauthorized') || msg.content.includes('falha de autorização') || msg.content.includes('Reconectar Google Agenda')) && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={onReconnect}
                      className="inline-flex items-center space-x-2 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reconectar Google Agenda</span>
                    </button>
                  </div>
                )}

                {/* Direct Retry Button if message encountered an error */}
                {msg.isError && msg.retryText && (
                  <div className="mt-3 pt-2.5 border-t border-rose-200 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-rose-700 font-medium">A mensagem não foi concluída.</span>
                    <button
                      type="button"
                      onClick={() => (onRetryMessage ? onRetryMessage(msg.retryText!, msg.id) : onSendMessage(msg.retryText!))}
                      disabled={isLoading}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Tentar novamente</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing / Processing indicator */}
        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="w-7 h-7 rounded-lg bg-white text-emerald-700 border border-slate-200 flex items-center justify-center text-xs font-semibold shadow-2xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white rounded-2xl p-3.5 rounded-tl-xs border border-slate-200 flex items-center space-x-3 text-xs text-slate-600 shadow-xs">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700 shrink-0" />
                <span>Consultando agenda e regras do RenovaSer...</span>
              </div>
              {onCancelLoading && (
                <button
                  type="button"
                  onClick={onCancelLoading}
                  className="px-2 py-0.5 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 cursor-pointer transition-colors shrink-0"
                  title="Cancelar espera e tentar novamente"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Session Expired Prompt Banner */}
      {isTokenExpired && onReconnect && (
        <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
          <div className="flex items-center space-x-2">
            <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Sua permissão com o Google Agenda expirou por segurança (validade padrão de 1 hora).</span>
          </div>
          <button
            type="button"
            onClick={onReconnect}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reconectar Google Agenda</span>
          </button>
        </div>
      )}

      {/* Input Box */}
      <div className="p-3 border-t border-slate-100 bg-white">
        {/* Quick category prefill chips */}
        <div className="flex items-center space-x-1.5 mb-2 overflow-x-auto pb-1 text-[11px]">
          <span className="text-slate-400 font-bold shrink-0 flex items-center space-x-1">
            <Tag className="w-3 h-3 text-slate-400" />
            <span>Inserir:</span>
          </span>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('atendimento')}
            className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold transition-colors shrink-0 cursor-pointer"
            title="Agendar atendimento com hora marcada"
          >
            + Atendimento
          </button>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('reuniao')}
            className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold transition-colors shrink-0 cursor-pointer"
            title="Reunião com tempo conforme necessidade"
          >
            + Reunião
          </button>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('comunicacao')}
            className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold transition-colors shrink-0 cursor-pointer"
            title="Registrar comunicação ou aviso oficial"
          >
            + Comunicação
          </button>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('workshop')}
            className="px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold transition-colors shrink-0 cursor-pointer"
            title="Evento: Workshop"
          >
            + Workshop
          </button>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('treinamento')}
            className="px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold transition-colors shrink-0 cursor-pointer"
            title="Evento: Treinamento"
          >
            + Treinamento
          </button>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('formacao')}
            className="px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold transition-colors shrink-0 cursor-pointer"
            title="Evento: Formação"
          >
            + Formação
          </button>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('transmissao_online')}
            className="px-2 py-0.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-bold transition-colors shrink-0 cursor-pointer"
            title="Evento: Transmissão on-line (Meet)"
          >
            + Transmissão on-line
          </button>
        </div>

        {/* Meeting Participant Selector Toolbar */}
        <div className="mb-2.5 p-2 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs">
          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
            <div className="flex items-center space-x-1.5 text-emerald-950 font-bold">
              <Users className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Participantes da Reunião:</span>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={handleToggleAllTherapists}
                className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition-colors border cursor-pointer ${
                  isAllTherapistsSelected
                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Convidar toda a equipe de terapeutas"
              >
                👥 Todos os Terapeutas ({therapists.length})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {therapists.map((t) => {
              const isSelected =
                isAllTherapistsSelected ||
                selectedTherapistEmails.includes(t.email.toLowerCase());
              return (
                <button
                  key={t.id || t.email}
                  type="button"
                  onClick={() => handleToggleSingleTherapist(t.email.toLowerCase())}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-emerald-950 border-emerald-400 ring-1 ring-emerald-500/20 shadow-2xs'
                      : 'bg-slate-100/80 text-slate-500 border-slate-200 hover:bg-slate-200/60'
                  }`}
                  title={`${t.name} (${t.specialty || 'Terapeuta'}) - Clique para marcar ou desmarcar`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      isSelected
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-300 text-slate-600'
                    }`}
                  >
                    {isSelected ? '✓' : t.name.slice(0, 1)}
                  </span>
                  <span>{t.name}</span>
                  <span className="text-[10px] opacity-75 font-normal">
                    ({t.specialty || 'Terapeuta'})
                  </span>
                </button>
              );
            })}

            <div className="ml-auto flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => handleInsertMeetingPrompt('Hoje às 19h30')}
                className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                title="Inserir texto da reunião no campo de digitação"
              >
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Preencher 19h30</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  let participantDesc = '';
                  if (
                    isAllTherapistsSelected ||
                    selectedTherapistEmails.length === 0 ||
                    selectedTherapistEmails.length === therapists.length
                  ) {
                    participantDesc = 'equipe de terapeutas';
                  } else {
                    const selectedObjs = therapists.filter((t) =>
                      selectedTherapistEmails.includes(t.email.toLowerCase())
                    );
                    participantDesc =
                      selectedObjs.length > 0
                        ? selectedObjs.map((t) => t.name).join(' e ')
                        : 'equipe de terapeutas';
                  }
                  const prompt = `Gostaria de agendar uma Reunião com tempo definido conforme a necessidade. Hoje às 19h30, com ${participantDesc}.`;
                  onSendMessage(prompt);
                }}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                title="Agendar imediatamente hoje às 19h30 com os participantes selecionados sem esperar"
              >
                <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                <span>⚡ Agendar Reunião 19h30</span>
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex items-end space-x-2.5">
          <div className="relative flex-1">
            <textarea
              id="input-chat-message"
              ref={textareaRef}
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite aqui sua solicitação (ex: 'Gostaria de agendar um Evento do tipo Formação no Instituto RenovaSer. Data e horário sugeridos: próximo sábado das 09:00 às 18:00')..."
              className="w-full resize-y min-h-[95px] max-h-[260px] p-3.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all placeholder:text-slate-400 leading-relaxed shadow-2xs"
            />
          </div>

          <button
            id="btn-send-message"
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 text-white disabled:text-slate-400 transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-xs flex items-center justify-center self-end"
            title="Enviar mensagem (Enter)"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 mt-1">
          <span>Pressione Enter para enviar, Shift+Enter para quebrar linha</span>
          <span>Fuso: GMT-3 (São Paulo)</span>
        </div>
      </div>
    </div>
  );
};
