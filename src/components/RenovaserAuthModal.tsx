import React, { useState } from 'react';
import {
  X,
  Shield,
  UserCheck,
  UserPlus,
  Lock,
  Mail,
  Briefcase,
  Trash2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
import type { AppUser } from '../types';
import {
  INITIAL_ADMINS,
  getRegisteredUsers,
  loginWithEmailPassword,
  registerProfessional,
  removeProfessional,
} from '../lib/renovaserAuth';

interface RenovaserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUser: AppUser | null;
  onUserChanged: (user: AppUser | null) => void;
}

export const RenovaserAuthModal: React.FC<RenovaserAuthModalProps> = ({
  isOpen,
  onClose,
  activeUser,
  onUserChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'adminPanel'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginFeedback, setLoginFeedback] = useState<{ isError: boolean; message: string } | null>(null);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSpecialty, setRegSpecialty] = useState('');
  const [regFeedback, setRegFeedback] = useState<{ isError: boolean; message: string } | null>(null);

  // Admin panel state
  const [registeredUsersList, setRegisteredUsersList] = useState(getRegisteredUsers());
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdminQuickSelect = (admin: (typeof INITIAL_ADMINS)[0]) => {
    setLoginEmail(admin.email);
    setLoginPassword('');
    setLoginFeedback({
      isError: false,
      message: `Administrador(a) ${admin.name} selecionado(a). Digite sua senha para entrar.`,
    });
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginFeedback(null);
    const result = loginWithEmailPassword(loginEmail, loginPassword);
    if (result.success && result.user) {
      setLoginFeedback({ isError: false, message: result.message });
      onUserChanged(result.user);
      setTimeout(() => {
        onClose();
      }, 700);
    } else {
      setLoginFeedback({
        isError: true,
        message: result.message,
      });
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegFeedback(null);
    const result = registerProfessional(regName, regEmail, regPassword, regSpecialty);
    if (result.success && result.user) {
      setRegFeedback({ isError: false, message: result.message });
      setRegisteredUsersList(getRegisteredUsers());
      onUserChanged(result.user);
      setTimeout(() => {
        onClose();
      }, 900);
    } else {
      setRegFeedback({ isError: true, message: result.message });
    }
  };

  const handleRemoveProfessional = (targetEmail: string) => {
    if (!activeUser || activeUser.role !== 'admin') return;
    const res = removeProfessional(targetEmail, activeUser);
    setAdminFeedback(res.message);
    setRegisteredUsersList(getRegisteredUsers());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="renovaser-auth-modal"
        className="bg-white rounded-2xl border border-[#E2DFD4] shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 bg-[#FAF9F5] border-b border-[#E2DFD4] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#5C6B5A] text-white flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#2E3029]">
                Identificação - Instituto RenovaSer
              </h3>
              <p className="text-xs text-[#76766D]">
                {activeUser
                  ? `Sessão atual: ${activeUser.name} (${activeUser.role === 'admin' ? 'Administrador' : activeUser.specialty || 'Profissional'})`
                  : 'Faça login com e-mail e senha ou cadastre-se'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#76766D] hover:text-[#2E3029] hover:bg-[#EDEBE1] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E2DFD4] bg-[#FAF9F5]/50 px-4 pt-2">
          <button
            onClick={() => setActiveTab('login')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'login'
                ? 'border-[#5C6B5A] text-[#5C6B5A]'
                : 'border-transparent text-[#76766D] hover:text-[#2E3029]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Login de Usuário</span>
          </button>

          <button
            onClick={() => setActiveTab('register')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'register'
                ? 'border-[#5C6B5A] text-[#5C6B5A]'
                : 'border-transparent text-[#76766D] hover:text-[#2E3029]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Cadastro de Profissional</span>
          </button>

          {activeUser?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('adminPanel')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'adminPanel'
                  ? 'border-[#5C6B5A] text-[#5C6B5A]'
                  : 'border-transparent text-[#76766D] hover:text-[#2E3029]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Gerenciar Profissionais</span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'login' && (
            <div className="space-y-4">
              {/* Quick Select for the 3 Admins */}
              <div className="p-3 bg-[#FAF9F5] rounded-xl border border-[#E2DFD4]">
                <p className="text-xs font-semibold text-[#2E3029] mb-2 flex items-center space-x-1">
                  <Shield className="w-3.5 h-3.5 text-[#5C6B5A]" />
                  <span>Acesso Rápido - Administradores:</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {INITIAL_ADMINS.map((adm) => (
                    <button
                      key={adm.id}
                      type="button"
                      onClick={() => handleAdminQuickSelect(adm)}
                      className="p-2 text-left bg-white hover:bg-[#EDEBE1] rounded-lg border border-[#DCD8CD] transition-all text-xs cursor-pointer"
                    >
                      <div className="font-semibold text-[#2E3029]">{adm.name}</div>
                      <div className="text-[10px] text-[#76766D] truncate">{adm.email}</div>
                    </button>
                  ))}
                </div>
              </div>

              {loginFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center space-x-2 border ${
                    loginFeedback.isError
                      ? 'bg-[#FDF2F2] border-[#F0D5D5] text-[#A25852]'
                      : 'bg-[#EBF0E9] border-[#C5D8C3] text-[#4F6F52]'
                  }`}
                >
                  {loginFeedback.isError ? (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>{loginFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#4A4A43] mb-1">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#8C8C80] absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="ex: claudirisrael@gmail.com ou seu e-mail"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E2DFD4] rounded-xl text-[#2E3029] focus:outline-none focus:ring-2 focus:ring-[#5C6B5A]/20 focus:border-[#5C6B5A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A4A43] mb-1">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#8C8C80] absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Sua senha de acesso"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E2DFD4] rounded-xl text-[#2E3029] focus:outline-none focus:ring-2 focus:ring-[#5C6B5A]/20 focus:border-[#5C6B5A]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#5C6B5A] hover:bg-[#4D5A4B] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Entrar no Sistema</span>
                </button>
              </form>
            </div>
          )}

          {activeTab === 'register' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#FAF9F5] rounded-xl border border-[#E2DFD4] text-xs text-[#76766D]">
                Profissionais atendem com hora marcada na sala do instituto. Ao se cadastrar, você
                terá acesso à sua própria agenda de atendimentos e eventos gerais.
              </div>

              {regFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center space-x-2 border ${
                    regFeedback.isError
                      ? 'bg-[#FDF2F2] border-[#F0D5D5] text-[#A25852]'
                      : 'bg-[#EBF0E9] border-[#C5D8C3] text-[#4F6F52]'
                  }`}
                >
                  {regFeedback.isError ? (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>{regFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#4A4A43] mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ex: Dra. Mariana Silva"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD4] rounded-xl text-[#2E3029] focus:outline-none focus:ring-2 focus:ring-[#5C6B5A]/20 focus:border-[#5C6B5A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A4A43] mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="mariana@exemplo.com"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD4] rounded-xl text-[#2E3029] focus:outline-none focus:ring-2 focus:ring-[#5C6B5A]/20 focus:border-[#5C6B5A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A4A43] mb-1">
                    Área de Atuação / Especialidade
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-[#8C8C80] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={regSpecialty}
                      onChange={(e) => setRegSpecialty(e.target.value)}
                      placeholder="Ex: Psicólogo, Fisioterapeuta, Nutricionista"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E2DFD4] rounded-xl text-[#2E3029] focus:outline-none focus:ring-2 focus:ring-[#5C6B5A]/20 focus:border-[#5C6B5A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A4A43] mb-1">
                    Senha Escolhida
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Defina uma senha segura"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD4] rounded-xl text-[#2E3029] focus:outline-none focus:ring-2 focus:ring-[#5C6B5A]/20 focus:border-[#5C6B5A]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#5C6B5A] hover:bg-[#4D5A4B] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Cadastrar e Conectar</span>
                </button>
              </form>
            </div>
          )}

          {activeTab === 'adminPanel' && activeUser?.role === 'admin' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2E3029]">
                  Profissionais Registrados no Instituto
                </span>
                <span className="text-[11px] text-[#76766D]">
                  {registeredUsersList.filter((u) => u.role === 'professional').length} profissionais
                </span>
              </div>

              {adminFeedback && (
                <div className="p-3 bg-[#EBF0E9] border border-[#C5D8C3] text-[#4F6F52] rounded-xl text-xs">
                  {adminFeedback}
                </div>
              )}

              <div className="space-y-2">
                {registeredUsersList
                  .filter((u) => u.role === 'professional')
                  .map((prof) => (
                    <div
                      key={prof.id}
                      className="p-3 rounded-xl border border-[#E2DFD4] bg-white flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-[#2E3029]">{prof.name}</div>
                        <div className="text-[#76766D]">{prof.email}</div>
                        <span className="inline-block px-2 py-0.5 mt-1 rounded bg-[#EDEBE1] text-[#5C6B5A] text-[10px] font-medium">
                          {prof.specialty || 'Profissional'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveProfessional(prof.email)}
                        className="p-1.5 text-[#A25852] hover:bg-[#FDF2F2] rounded-lg transition-colors cursor-pointer"
                        title="Remover profissional"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                {registeredUsersList.filter((u) => u.role === 'professional').length === 0 && (
                  <p className="text-xs text-[#8C8C80] text-center py-4">
                    Nenhum profissional cadastrado além dos 3 administradores. Novos profissionais
                    podem se cadastrar na aba anterior.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
