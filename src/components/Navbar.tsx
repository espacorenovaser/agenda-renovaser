import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  LogOut,
  History,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  HelpCircle,
  Briefcase,
  Shield,
  Sparkles,
} from 'lucide-react';
import type { UserProfile, AppUser } from '../types';
import { SAO_PAULO_TZ } from '../lib/dateUtils';

interface NavbarProps {
  user: UserProfile | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn: boolean;
  onOpenHistory: () => void;
  calendarConnected: boolean;
  activeUser?: AppUser | null;
  onOpenAuthModal?: () => void;
  isInIframe?: boolean;
  onOpenAuthHelp?: () => void;
  onOpenChat?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogin,
  onLogout,
  isLoggingIn,
  onOpenHistory,
  calendarConnected,
  activeUser,
  onOpenAuthModal,
  isInIframe,
  onOpenAuthHelp,
  onOpenChat,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: SAO_PAULO_TZ,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);
      setCurrentTime(timeStr);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header id="app-navbar" className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
                  Instituto RenovaSer
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Agenda Interna
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Atendimentos com hora marcada, eventos gerais e comunicação oficial
              </p>
            </div>
          </div>

          {/* Timezone & Controls */}
          <div className="flex items-center space-x-3">
            {/* SP Time Badge */}
            <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-mono border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-emerald-700" />
              <span>SP: {currentTime || '--:--:--'}</span>
              <span className="text-slate-400">(GMT-3)</span>
            </div>

            {/* RenovaSer User Badge & Switcher */}
            {onOpenAuthModal && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 shadow-2xs transition-colors cursor-pointer"
                title="Trocar usuário ou cadastrar profissional"
              >
                {activeUser?.role === 'admin' ? (
                  <Shield className="w-4 h-4 text-emerald-700" />
                ) : (
                  <Briefcase className="w-4 h-4 text-amber-600" />
                )}
                <div className="text-left">
                  <div className="leading-tight font-bold flex items-center space-x-1 text-slate-900">
                    <span>{activeUser ? activeUser.name : 'Identificar-se'}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({activeUser?.role === 'admin' ? 'Admin' : activeUser?.specialty || 'Profissional'})
                    </span>
                  </div>
                </div>
              </button>
            )}

            {/* Button to Open Assistant Chat */}
            {onOpenChat && (
              <button
                id="nav-btn-open-chat"
                type="button"
                onClick={onOpenChat}
                className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer border border-emerald-800"
                title="Registrar horário na agenda com o assistente"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                <span>+ Registrar Horário</span>
              </button>
            )}

            {user ? (
              <div className="flex items-center space-x-2 sm:space-x-3">
                {/* Calendar Status */}
                {calendarConnected ? (
                  <div
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-200"
                    title="Conectado com sucesso ao Google Agenda"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="hidden xl:inline">Agenda Conectada</span>
                  </div>
                ) : (
                  <button
                    id="btn-reconnect-agenda"
                    onClick={onLogin}
                    disabled={isLoggingIn}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200 transition-colors cursor-pointer shadow-2xs"
                    title="Sessão expirada. Clique para reconectar a conta Google Agenda"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                    <span>{isLoggingIn ? 'Conectando...' : 'Reconectar Agenda'}</span>
                  </button>
                )}

                {/* History Button */}
                <button
                  id="btn-open-history"
                  onClick={onOpenHistory}
                  className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Histórico de Ações"
                >
                  <History className="w-4 h-4" />
                </button>

                {/* User Info */}
                <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Usuário'}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full border border-slate-200"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-emerald-800 font-bold text-xs flex items-center justify-center border border-slate-200">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="hidden 2xl:block text-left text-xs">
                    <p className="font-bold text-slate-900 leading-tight truncate max-w-[120px]">
                      {user.displayName || 'Google Account'}
                    </p>
                    <p className="text-slate-500 leading-tight truncate max-w-[120px]">{user.email}</p>
                  </div>

                  <button
                    id="btn-logout"
                    onClick={onLogout}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Desconectar Google"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5">
                {/* Google Sign-in Button compliant with Google Guidelines */}
                <button
                  id="btn-google-login"
                  onClick={onLogin}
                  disabled={isLoggingIn}
                  className="inline-flex items-center space-x-2 px-3.5 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-800 hover:bg-slate-50 text-xs sm:text-sm font-semibold shadow-xs transition-all disabled:opacity-60 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
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

                {/* If in iframe, provide direct New Tab button because browsers block iframe popups */}
                {isInIframe && (
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir em Nova Aba (sem restrições de pop-up do iframe)"
                    className="p-1.5 border border-slate-200 rounded-xl bg-white text-emerald-800 hover:bg-slate-50 transition-colors flex items-center justify-center cursor-pointer shadow-xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {onOpenAuthHelp && (
                  <button
                    type="button"
                    onClick={onOpenAuthHelp}
                    title="Ajuda sobre conexão com Google Agenda"
                    className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
