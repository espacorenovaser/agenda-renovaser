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
  XCircle,
  CornerDownLeft,
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
} from 'lucide-react';
import type { ChatMessage, PendingAction, CalendarEvent, AppUser } from '../types';
import { formatDateTimeBR, formatTimeBR } from '../lib/dateUtils';

interface ChatAssistantProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => Promise<void>;
  onConfirmPendingAction: (action: PendingAction) => Promise<void>;
  prefilledInput: string;
  setPrefilledInput: (val: string) => void;
  onReconnect?: () => void;
  isTokenExpired?: boolean;
  activeUser?: AppUser | null;
  onOpenAuthModal?: () => void;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onConfirmPendingAction,
  prefilledInput,
  setPrefilledInput,
  onReconnect,
  isTokenExpired,
  activeUser,
  onOpenAuthModal,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
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

  const sampleSuggestions = [
    'Agendar atendimento amanhã às 14h (60 min)',
    'Agendar atendimento de 90 min na sala',
    'Agendar reunião de alinhamento com a equipe',
    'Agendar evento Workshop para sábado às 14h',
    'Agendar transmissão on-line com link do Meet',
    'Quais são os horários livres na sala esta semana?',
  ];

  const handleQuickSchedulePrompt = (category: string) => {
    let prompt = '';
    if (category === 'atendimento_60') {
      prompt = 'Gostaria de agendar um Atendimento de 60 minutos com hora marcada na sala para amanhã às ';
    } else if (category === 'atendimento_90') {
      prompt = 'Gostaria de agendar um Atendimento de 90 minutos com hora marcada na sala para amanhã às ';
    } else if (category === 'reuniao') {
      prompt = 'Gostaria de agendar uma Reunião com a equipe de ';
    } else if (category === 'workshop') {
      prompt = 'Gostaria de agendar um Evento do tipo Workshop no Instituto RenovaSer para ';
    } else if (category === 'treinamento') {
      prompt = 'Gostaria de agendar um Evento do tipo Treinamento no Instituto RenovaSer para ';
    } else if (category === 'formacao') {
      prompt = 'Gostaria de agendar um Evento do tipo Formação no Instituto RenovaSer para ';
    } else if (category === 'transmissao_online') {
      prompt = 'Gostaria de agendar um Evento do tipo Transmissão on-line com link do Google Meet para ';
    }
    setInputText(prompt);
    textareaRef.current?.focus();
  };

  return (
    <div id="chat-assistant-container" className="bg-white rounded-2xl border border-[#E2DFD4] shadow-xs flex flex-col h-full overflow-hidden">
      {/* Assistant Header */}
      <div className="p-4 border-b border-[#E2DFD4] bg-[#FAF9F5] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-[#5C6B5A] text-white flex items-center justify-center shadow-2xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#2E3029] flex items-center space-x-1.5">
              <span>Agenda RenovaSer</span>
              <span className="inline-block w-2 h-2 rounded-full bg-[#4F6F52]" />
            </h2>
            <p className="text-xs text-[#76766D]">
              {activeUser ? (
                <span className="flex items-center space-x-1">
                  <span>Conectado como:</span>
                  <strong className="text-[#2E3029]">{activeUser.name}</strong>
                  <span className="text-[#8C8C80]">
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
          {onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="text-xs px-2.5 py-1 rounded-lg border border-[#DCD8CD] bg-white hover:bg-[#EDEBE1] text-[#5C6B5A] font-medium transition-colors cursor-pointer flex items-center space-x-1"
            >
              {activeUser?.role === 'admin' ? (
                <Shield className="w-3.5 h-3.5" />
              ) : (
                <Briefcase className="w-3.5 h-3.5" />
              )}
              <span>{activeUser ? 'Trocar Acesso' : 'Identificar-se'}</span>
            </button>
          )}

          <div className="text-[11px] text-[#8C8C80] font-mono hidden sm:block">
            GMT-3 (SP)
          </div>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF9F5]/40">
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
                    ? 'bg-[#5C6B5A] text-white'
                    : 'bg-[#EDEBE1] text-[#5C6B5A] border border-[#DCD8CD]'
                }`}
              >
                {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-[#5C6B5A] text-[#F7F5F0] rounded-tr-xs shadow-2xs'
                    : 'bg-[#FAF9F5] text-[#4A4A43] rounded-tl-xs border border-[#E2DFD4] shadow-2xs'
                }`}
              >
                {/* Text Content with formatted lines */}
                <div className="whitespace-pre-wrap font-sans text-sm space-y-1">
                  {msg.content.split('\n').map((line, idx) => {
                    const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
                    if (isBullet) {
                      return (
                        <div key={idx} className="flex items-start space-x-2 pl-1 py-0.5">
                          <span className={isUser ? 'text-[#C5D8C3]' : 'text-[#8C9484]'}>•</span>
                          <span className="flex-1">{line.replace(/^[-•]\s*/, '')}</span>
                        </div>
                      );
                    }
                    return <p key={idx}>{line}</p>;
                  })}
                </div>

                {/* Formatted Email Notice Card (with one-click Copy) */}
                {noticeBlock && (
                  <div className="mt-3 p-3 bg-white rounded-xl border border-[#C5D8C3] shadow-xs text-xs text-[#2E3029]">
                    <div className="flex items-center justify-between pb-2 border-b border-[#EDEBE1] mb-2">
                      <span className="font-semibold text-[#4F6F52] flex items-center space-x-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        <span>Comunicado por E-mail Oficial</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleCopyText(noticeBlock, `notice-${msg.id}`)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#EDEBE1] hover:bg-[#E2DFD4] text-[#4A4A43] rounded-lg font-medium transition-colors cursor-pointer"
                      >
                        {copiedId === `notice-${msg.id}` ? (
                          <>
                            <Check className="w-3 h-3 text-[#4F6F52]" />
                            <span className="text-[#4F6F52]">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar E-mail</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="font-mono text-[11px] text-[#4A4A43] whitespace-pre-wrap leading-relaxed bg-[#FAF9F5] p-2.5 rounded-lg border border-[#E2DFD4]">
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
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#4F6F52] hover:bg-[#415D44] text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
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
                        className="p-3 bg-white rounded-xl border border-[#C5D8C3] shadow-2xs text-[#4A4A43] text-xs"
                      >
                        <div className="flex items-center space-x-2 text-[#4F6F52] font-semibold mb-1">
                          <CalendarCheck className="w-4 h-4" />
                          <span>Atendimento confirmado na agenda!</span>
                        </div>
                        <p className="font-semibold text-[#2E3029] text-sm">{ev.title}</p>
                        <p className="text-[#76766D] mt-1 flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#8C9484]" />
                          <span>
                            {formatDateTimeBR(ev.start)} – {formatTimeBR(ev.end)}
                          </span>
                        </p>

                        {ev.attendees && ev.attendees.length > 0 && (
                          <p className="text-[#76766D] mt-1 flex items-center space-x-1.5">
                            <Users className="w-3.5 h-3.5 text-[#8C9484]" />
                            <span>Participantes: {ev.attendees.join(', ')}</span>
                          </p>
                        )}

                        <div className="mt-2 pt-2 border-t border-[#EDEBE1] flex flex-wrap gap-2">
                          {ev.meetLink && (
                            <a
                              href={ev.meetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#4F6F52] hover:bg-[#415D44] text-white rounded-lg font-medium text-xs transition-colors"
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
                              className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#5C6B5A] hover:bg-[#4D5A4B] text-white rounded-lg font-medium text-xs transition-colors"
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
                          className="p-3 bg-[#FBF8EF] rounded-xl border border-[#E0D5B5] text-[#4A4A43] text-xs"
                        >
                          <div className="flex items-center space-x-1.5 text-[#9B7030] font-semibold mb-1">
                            <AlertTriangle className="w-4 h-4" />
                            <span>
                              {isDel
                                ? 'Confirmação necessária para cancelamento'
                                : 'Confirmação necessária para reagendamento'}
                            </span>
                          </div>
                          <p className="text-[#4A4A43]">
                            Evento: <strong>{action.args.eventTitle}</strong>
                          </p>
                          {action.args.newStartDateTime && (
                            <p className="text-[#4A4A43] mt-0.5">
                              Novo Horário: <strong>{formatDateTimeBR(action.args.newStartDateTime)}</strong>
                            </p>
                          )}

                          <div className="mt-2 flex space-x-2">
                            <button
                              onClick={() => onConfirmPendingAction(action)}
                              className="px-3 py-1 bg-[#9B7030] hover:bg-[#865E23] text-white font-medium rounded-lg text-xs transition-colors flex items-center space-x-1 cursor-pointer"
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
                  <div className="mt-3 pt-2.5 border-t border-[#E2DFD4]">
                    <button
                      type="button"
                      onClick={onReconnect}
                      className="inline-flex items-center space-x-2 px-3.5 py-2 bg-[#5C6B5A] hover:bg-[#4D5A4B] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reconectar Google Agenda</span>
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
            <div className="w-7 h-7 rounded-lg bg-[#EDEBE1] text-[#5C6B5A] border border-[#DCD8CD] flex items-center justify-center text-xs font-semibold">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-[#FAF9F5] rounded-2xl p-3.5 rounded-tl-xs border border-[#E2DFD4] flex items-center space-x-2 text-xs text-[#76766D]">
              <Loader2 className="w-4 h-4 animate-spin text-[#5C6B5A]" />
              <span>Consultando agenda e regras do RenovaSer...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 border-t border-[#E2DFD4] bg-[#FAF9F5]">
          <p className="text-[11px] text-[#76766D] font-medium mb-1.5 flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-[#9B7030]" />
            <span>Sugestões rápidas:</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sampleSuggestions.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSendMessage(sug)}
                className="text-[11px] px-2.5 py-1 bg-[#EDEBE1] hover:bg-[#E2DFD4] text-[#4A4A43] rounded-lg border border-[#DCD8CD] transition-colors text-left cursor-pointer"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Session Expired Prompt Banner */}
      {isTokenExpired && onReconnect && (
        <div className="px-4 py-2.5 bg-[#FBF8EF] border-t border-[#E0D5B5] flex flex-wrap items-center justify-between gap-2 text-xs text-[#9B7030]">
          <div className="flex items-center space-x-2">
            <KeyRound className="w-4 h-4 text-[#9B7030] shrink-0" />
            <span>Sua permissão com o Google Agenda expirou por segurança (validade padrão de 1 hora).</span>
          </div>
          <button
            type="button"
            onClick={onReconnect}
            className="px-3 py-1 bg-[#9B7030] hover:bg-[#865E23] text-white font-medium rounded-lg text-xs transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reconectar Google Agenda</span>
          </button>
        </div>
      )}

      {/* Input Box */}
      <div className="p-3 border-t border-[#E2DFD4] bg-white">
        {/* Quick category prefill chips */}
        <div className="flex items-center space-x-1.5 mb-2 overflow-x-auto pb-1 text-[11px]">
          <span className="text-[#76766D] font-medium shrink-0 flex items-center space-x-1">
            <Tag className="w-3 h-3 text-[#8C9484]" />
            <span>Inserir:</span>
          </span>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('atendimento_60')}
            className="px-2 py-0.5 rounded-md bg-[#EBF0E9] hover:bg-[#DEE8DC] text-[#3D5A3F] border border-[#C2D6C0] font-medium transition-colors shrink-0 cursor-pointer"
            title="Atendimento de 60 minutos"
          >
            + Atendimento (60m)
          </button>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('atendimento_90')}
            className="px-2 py-0.5 rounded-md bg-[#EBF0E9] hover:bg-[#DEE8DC] text-[#3D5A3F] border border-[#C2D6C0] font-medium transition-colors shrink-0 cursor-pointer"
            title="Atendimento de 90 minutos"
          >
            + Atendimento (90m)
          </button>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('reuniao')}
            className="px-2 py-0.5 rounded-md bg-[#FDF6E2] hover:bg-[#F9EDCA] text-[#8C6D23] border border-[#E8D9A8] font-medium transition-colors shrink-0 cursor-pointer"
            title="Reunião com tempo conforme necessidade"
          >
            + Reunião
          </button>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('workshop')}
            className="px-2 py-0.5 rounded-md bg-[#F2EEFA] hover:bg-[#E7DFF5] text-[#6B4B9A] border border-[#D8CEEE] font-medium transition-colors shrink-0 cursor-pointer"
            title="Evento: Workshop"
          >
            + Workshop
          </button>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('treinamento')}
            className="px-2 py-0.5 rounded-md bg-[#F2EEFA] hover:bg-[#E7DFF5] text-[#6B4B9A] border border-[#D8CEEE] font-medium transition-colors shrink-0 cursor-pointer"
            title="Evento: Treinamento"
          >
            + Treinamento
          </button>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('formacao')}
            className="px-2 py-0.5 rounded-md bg-[#F2EEFA] hover:bg-[#E7DFF5] text-[#6B4B9A] border border-[#D8CEEE] font-medium transition-colors shrink-0 cursor-pointer"
            title="Evento: Formação"
          >
            + Formação
          </button>
          <button
            type="button"
            onClick={() => handleQuickSchedulePrompt('transmissao_online')}
            className="px-2 py-0.5 rounded-md bg-[#F2EEFA] hover:bg-[#E7DFF5] text-[#6B4B9A] border border-[#D8CEEE] font-medium transition-colors shrink-0 cursor-pointer"
            title="Evento: Transmissão on-line (Meet)"
          >
            + Transmissão on-line
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex items-end space-x-2">
          <div className="relative flex-1">
            <textarea
              id="input-chat-message"
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: 'Agendar atendimento amanhã às 14h com Dr. Marcelo' ou 'Quais meus compromissos hoje?'..."
              className="w-full resize-none px-3.5 py-2.5 text-sm bg-[#FAF9F5] border border-[#E2DFD4] text-[#2E3029] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5C6B5A]/20 focus:border-[#5C6B5A] transition-all placeholder:text-[#8C8C80]"
              style={{ maxHeight: '120px' }}
            />
          </div>

          <button
            id="btn-send-message"
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 rounded-xl bg-[#5C6B5A] hover:bg-[#4C594A] disabled:bg-[#EDEBE1] text-white disabled:text-[#8C8C80] transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
            title="Enviar mensagem (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="flex items-center justify-between text-[10px] text-[#8C8C80] px-1 mt-1">
          <span>Pressione Enter para enviar, Shift+Enter para quebrar linha</span>
          <span>Fuso: GMT-3 (São Paulo)</span>
        </div>
      </div>
    </div>
  );
};
