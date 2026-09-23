import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  UserCheck, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  UserPlus,
  Compass,
  KeyRound
} from 'lucide-react';
import type { TherapistUser } from '../types';
import { authenticateWithPassword, registerNewUser } from '../lib/authService';
import { googleSignIn } from '../lib/firebase';
import { saveTherapist } from '../lib/firestoreService';

interface LoginScreenProps {
  therapists: TherapistUser[];
  onLoginSuccess: (user: TherapistUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ therapists, onLoginSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Estados do Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Estados do Cadastro
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTechnique, setRegTechnique] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<'terapeuta' | 'admin'>('terapeuta');
  const [regError, setRegError] = useState<string | null>(null);

  // Contas sugeridas para facilitar teste
  const sampleAccounts = [
    {
      name: 'Claudir Israel',
      email: 'claudirisrael@gmail.com',
      role: 'admin',
      roleLabel: 'Administrador (Acesso Total)',
      technique: 'Gestão & Coordenação',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      password: 'Rs12345678',
    },
    {
      name: 'Adriana Israel',
      email: 'acky0608@gmail.com',
      role: 'terapeuta',
      roleLabel: 'Terapeuta (Acesso Restrito)',
      technique: 'Tarô Terapêutico',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      password: 'renovaser123',
    },
    {
      name: 'Dr. Lucas',
      email: 'lucas.psico@institutorenovaser.com.br',
      role: 'terapeuta',
      roleLabel: 'Terapeuta (Acesso Restrito)',
      technique: 'Psicoterapia Integrativa',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      password: 'renovaser123',
    }
  ];

  const handleQuickSelect = (acc: typeof sampleAccounts[0]) => {
    setLoginEmail(acc.email);
    setLoginPassword(acc.password);
    setLoginError(null);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    try {
      const result = authenticateWithPassword(loginEmail, loginPassword, therapists);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setLoginError(result.message);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Erro inesperado ao realizar login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setLoginError(null);
    try {
      const res = await googleSignIn();
      if (!res?.user) {
        throw new Error('Não foi possível autenticar com o Google.');
      }
      const email = res.user.email || '';
      const existing = therapists.find((t) => t.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        onLoginSuccess(existing);
      } else {
        const isAdmin = email.includes('renovaser') || email.includes('claudirisrael');
        const newUser: TherapistUser = {
          id: `usr-${Date.now()}`,
          name: res.user.displayName || email.split('@')[0],
          email: email,
          role: isAdmin ? 'admin' : 'terapeuta',
          technique: 'Atendimento Integrativo',
          password: 'google-oauth-auth',
          createdAt: new Date().toISOString(),
        };
        await saveTherapist(newUser);
        onLoginSuccess(newUser);
      }
    } catch (err: any) {
      if (!err?.message?.includes('popup-closed-by-user')) {
        setLoginError(err.message || 'Erro ao autenticar com o Google.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (regPassword !== regConfirmPassword) {
      setRegError('A confirmação da senha não coincide com a senha digitada.');
      return;
    }

    if (regPassword.length < 4) {
      setRegError('A senha deve conter no mínimo 4 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newUser = await registerNewUser(
        {
          name: regName,
          email: regEmail,
          technique: regTechnique,
          password: regPassword,
          role: regRole,
        },
        therapists
      );
      onLoginSuccess(newUser);
    } catch (err: any) {
      setRegError(err.message || 'Erro ao realizar cadastro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex flex-col justify-center items-center p-4 selection:bg-emerald-100">
      {/* Container Principal */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E8E6DF] overflow-hidden">
        
        {/* Topo / Header da Instituição */}
        <div className="bg-gradient-to-b from-[#2E3C32] to-[#243027] text-white p-6 sm:p-8 text-center relative overflow-hidden">
          {/* Círculo sutil de fundo */}
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-md border border-white/20 flex items-center justify-center mb-3">
              <img
                src="/LogoAgenda.png"
                alt="Instituto RenovaSer"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Instituto RenovaSer
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 font-medium">
              Agenda & Gestão Integrada de Atendimentos
            </p>
            
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs">
              <Shield className="w-3.5 h-3.5" />
              <span>Acesso Individual Seguro com Senha</span>
            </div>
          </div>
        </div>

        {/* Abas: Entrar ou Cadastrar */}
        <div className="flex border-b border-[#E8E6DF] bg-[#FAF9F6]">
          <button
            type="button"
            onClick={() => { setTab('login'); setLoginError(null); }}
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              tab === 'login'
                ? 'text-[#2E3C32] border-b-2 border-[#2E3C32] bg-white'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Entrar com Senha</span>
          </button>
          
          <button
            type="button"
            onClick={() => { setTab('register'); setRegError(null); }}
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              tab === 'register'
                ? 'text-[#2E3C32] border-b-2 border-[#2E3C32] bg-white'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Primeiro Acesso</span>
          </button>
        </div>

        {/* Conteúdo da Aba */}
        <div className="p-6 sm:p-7 space-y-5">
          
          {/* ABA LOGIN */}
          {tab === 'login' && (
            <>
              {/* Mensagem de Erro */}
              {loginError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">{loginError}</div>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    E-mail Profissional
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="ex: claudirisrael@gmail.com ou acky0608@gmail.com"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF9F6] border border-[#D9D6CB] rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Sua Senha
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Padrão inicial: <code className="text-emerald-700 font-mono">renovaser123</code>
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Digite sua senha de acesso"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#FAF9F6] border border-[#D9D6CB] rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-[#2E3C32] hover:bg-[#243027] text-white font-semibold rounded-xl text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <span>{isSubmitting ? 'Verificando credenciais...' : 'Acessar o Sistema'}</span>
                </button>

                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#E8E6DF]" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase">
                    <span className="bg-white px-2 text-slate-400 font-semibold tracking-wider">ou acesse com</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isGoogleLoading || isSubmitting}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-[#D9D6CB] hover:border-slate-400 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{isGoogleLoading ? 'Autenticando com Google...' : 'Entrar com Conta Google'}</span>
                </button>
              </form>

              {/* Seção de Acesso Rápido para Teste das Funções */}
              <div className="pt-3 border-t border-[#E8E6DF] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Selecione para Testar os Papéis:
                  </span>
                </div>

                <div className="space-y-1.5">
                  {sampleAccounts.map((acc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickSelect(acc)}
                      className="w-full text-left p-2.5 rounded-xl border border-[#E8E6DF] bg-[#FAF9F6] hover:bg-emerald-50 hover:border-emerald-300 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
                            {acc.name}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${acc.badgeColor}`}>
                            {acc.role === 'admin' ? 'Admin' : 'Terapeuta'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{acc.technique}</span>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-slate-400">{acc.email}</span>
                        </div>
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-700 bg-white px-2 py-1 rounded-md border border-[#E8E6DF] group-hover:border-emerald-300">
                        Preencher
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ABA CADASTRO / PRIMEIRO ACESSO */}
          {tab === 'register' && (
            <>
              {regError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">{regError}</div>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ex: Adriana Israel"
                    className="w-full px-3.5 py-2 bg-[#FAF9F6] border border-[#D9D6CB] rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail Profissional
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Ex: acky0608@gmail.com"
                    className="w-full px-3.5 py-2 bg-[#FAF9F6] border border-[#D9D6CB] rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Técnica / Especialidade
                  </label>
                  <input
                    type="text"
                    value={regTechnique}
                    onChange={(e) => setRegTechnique(e.target.value)}
                    placeholder="Ex: Tarô, Reiki, Florais, Acupuntura"
                    className="w-full px-3.5 py-2 bg-[#FAF9F6] border border-[#D9D6CB] rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Papel no Instituto
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as 'terapeuta' | 'admin')}
                    className="w-full px-3.5 py-2 bg-[#FAF9F6] border border-[#D9D6CB] rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all"
                  >
                    <option value="terapeuta">Terapeuta (Acesso exclusivo à sua própria agenda)</option>
                    <option value="admin">Administrador (Acesso total a todas as agendas)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Crie sua Senha
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Mínimo 4 dígitos"
                      className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D9D6CB] rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirme a Senha
                    </label>
                    <input
                      type="password"
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#D9D6CB] rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3 bg-[#2E3C32] hover:bg-[#243027] text-white font-semibold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>{isSubmitting ? 'Criando conta...' : 'Cadastrar e Acessar Minha Agenda'}</span>
                </button>
              </form>
            </>
          )}

        </div>

        {/* Rodapé Informativo sobre Políticas de Acesso */}
        <div className="p-4 bg-[#FAF9F6] border-t border-[#E8E6DF] text-center text-[11px] text-slate-500">
          <p>
            <strong>Regras de Acesso:</strong> Administradores gerenciam a clínica completa. Terapeutas visualizam e agendam exclusivamente seus próprios atendimentos e clientes.
          </p>
        </div>

      </div>
    </div>
  );
};
