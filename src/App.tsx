import React, { useState } from 'react';
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
  X
} from 'lucide-react';

interface Evento {
  id: string;
  title: string;
  category: 'atendimento' | 'reuniao' | 'evento';
  time: string;
  date: string; // YYYY-MM-DD
  location: string;
  type: 'presencial' | 'online';
  therapistId: string;
  clientEmail?: string;
  badgeColor: string;
}

export default function Dashboard() {
  // --- ESTADOS DE FILTRO ---
  const [activeCategory, setActiveCategory] = useState<'all' | 'atendimento' | 'reuniao' | 'evento'>('all');
  const [viewPeriod, setViewPeriod] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [selectedTherapist, setSelectedTherapist] = useState<string>('todos');

  // --- ESTADOS DE MODAIS ---
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);

  // --- ESTADO DO CHAT / ASSISTENTE ---
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([
    {
      sender: 'assistant',
      text: 'Olá! Como posso ajudar na agenda hoje? Tente dizer: "Agendar reunião com a equipe de terapeutas hoje às 19h30"'
    }
  ]);

  // --- FORMULÁRIO DE NOVO EVENTO ---
  const [newEvent, setNewEvent] = useState({
    title: '',
    category: 'atendimento' as 'atendimento' | 'reuniao' | 'evento',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    location: 'Sala do Instituto RenovaSer',
    type: 'presencial' as 'presencial' | 'online',
    therapistId: 'admin1',
    clientEmail: ''
  });

  // --- DADOS MOCKADOS DE EXEMPLO ---
  const therapists = [
    { id: 'admin1', name: 'Claudir Israel (Admin)', role: 'admin' },
    { id: 'admin2', name: 'Maria Gorete (Admin)', role: 'admin' },
    { id: 'admin3', name: 'Cleci Marchioro (Admin)', role: 'admin' },
    { id: 'terapeuta1', name: 'Dr. Lucas (Terapeuta)', role: 'terapeuta' }
  ];

  const [events, setEvents] = useState<Evento[]>([
    {
      id: '1',
      title: 'Atendimento Clínico - Dr. Lucas',
      category: 'atendimento',
      time: '14:00 - 15:00',
      date: new Date().toISOString().split('T')[0],
      location: 'Sala do Instituto RenovaSer',
      type: 'presencial',
      therapistId: 'terapeuta1',
      clientEmail: 'cliente@exemplo.com',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    },
    {
      id: '2',
      title: 'Reunião com Equipe de Terapeutas',
      category: 'reuniao',
      time: '19:30 - 20:30',
      date: new Date().toISOString().split('T')[0],
      location: 'Online - Google Meet',
      type: 'online',
      therapistId: 'admin1',
      clientEmail: '',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200'
    }
  ]);

  // --- LÓGICA DO ASSISTENTE ---
  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput('');

    // Resposta simulada do assistente inteligente
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `Entendido! Agendamento para "${userMsg}" foi pré-processado com sucesso. Os dados foram adicionados à agenda.`
        }
      ]);
    }, 800);
  };

  // --- LÓGICA DE CRIAÇÃO DE EVENTO ---
  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const created: Evento = {
      id: Date.now().toString(),
      title: newEvent.title,
      category: newEvent.category,
      time: newEvent.time,
      date: newEvent.date,
      location: newEvent.location,
      type: newEvent.type,
      therapistId: newEvent.therapistId,
      clientEmail: newEvent.clientEmail,
      badgeColor:
        newEvent.category === 'atendimento'
          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
          : newEvent.category === 'reuniao'
          ? 'bg-blue-100 text-blue-800 border-blue-200'
          : 'bg-purple-100 text-purple-800 border-purple-200'
    };

    setEvents([...events, created]);
    setShowNewEventModal(false);
    
    if (newEvent.clientEmail) {
      alert(`Agendamento criado! Notificação enviada para: ${newEvent.clientEmail}`);
    }
  };

  // --- FILTRAGEM DE EVENTOS ---
  const filteredEvents = events.filter((e) => {
    const matchCategory = activeCategory === 'all' || e.category === activeCategory;
    const matchTherapist = selectedTherapist === 'todos' || e.therapistId === selectedTherapist;
    return matchCategory && matchTherapist;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* Topbar / Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              RS
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">Instituto RenovaSer</h1>
              <p className="text-xs text-slate-500 mt-1">Agenda & Gestão Integrada</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowNewUserModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
            >
              <UserPlus className="w-4 h-4 text-slate-600" />
              Cadastrar Utilizador
            </button>
            <button 
              onClick={() => setShowNewEventModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Novo Agendamento
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Painel Principal */}
        <section className="lg:col-span-2 space-y-6">
          
          {/* Banner */}
          <div className="bg-gradient-to-r from-emerald-800 to-teal-700 rounded-2xl p-6 text-white shadow-md">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-200">PAINEL GERAL</span>
            <h2 className="text-2xl font-bold mt-1">Transformação e Desenvolvimento Humano</h2>
            <p className="text-emerald-100 text-sm mt-1">
              Acompanhe os atendimentos, reuniões de equipe e eventos agendados.
            </p>
          </div>

          {/* Barra de Filtros (Dia/Semana/Mês e Profissionais) */}
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

              {/* Filtro de Período (Dia, Semana, Mês) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {(['dia', 'semana', 'mes'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setViewPeriod(period)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-all ${
                      viewPeriod === period ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            {/* Seleção de Profissional / Admin */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Responsável:
              </span>
              <select
                value={selectedTherapist}
                onChange={(e) => setSelectedTherapist(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
              >
                <option value="todos">Todos os Profissionais / Admins</option>
                {therapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lista de Compromissos */}
          <div className="space-y-3">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                Nenhum compromisso encontrado para os filtros selecionados.
              </div>
            ) : (
              filteredEvents.map((evt) => (
                <div 
                  key={evt.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${evt.badgeColor}`}>
                        {evt.category.toUpperCase()}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900">{evt.title}</h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
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
                      {evt.clientEmail && (
                        <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {evt.clientEmail}
                        </span>
                      )}
                    </div>
                  </div>

                  <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Lateral: Assistente Integrado */}
        <aside className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col h-[500px]">
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
                  className={`p-3 rounded-xl max-w-[85%] ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white ml-auto'
                      : 'bg-slate-100 text-slate-700 mr-auto'
                  }`}
                >
                  {msg.text}
                </div>
              ))}
            </div>

            {/* Input de Envio */}
            <div className="relative pt-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ex: Agendar reunião amanhã às 14h..."
                className="w-full pl-3 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
              <button 
                onClick={handleSendMessage}
                className="absolute right-2 top-4 text-emerald-600 hover:text-emerald-700 p-1"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

      </main>

      {/* MODAL: NOVO AGENDAMENTO */}
      {showNewEventModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Criar Novo Agendamento</h3>
              <button onClick={() => setShowNewEventModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-slate-700 block mb-1">Título do Compromisso</label>
                <input
                  type="text"
                  required
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Ex: Atendimento Terapêutico"
                  className="w-full p-2 bg-slate-50 border rounded-lg focus:outline-none focus:border-emerald-500"
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
                  <label className="font-medium text-slate-700 block mb-1">Responsável</label>
                  <select
                    value={newEvent.therapistId}
                    onChange={(e) => setNewEvent({ ...newEvent, therapistId: e.target.value })}
                    className="w-full p-2 bg-slate-50 border rounded-lg"
                  >
                    {therapists.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
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
                  <label className="font-medium text-slate-700 block mb-1">Horário</label>
                  <input
                    type="text"
                    required
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    placeholder="14:00 - 15:00"
                    className="w-full p-2 bg-slate-50 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">E-mail do Cliente (para notificação)</label>
                <input
                  type="email"
                  value={newEvent.clientEmail}
                  onChange={(e) => setNewEvent({ ...newEvent, clientEmail: e.target.value })}
                  placeholder="cliente@email.com"
                  className="w-full p-2 bg-slate-50 border rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewEventModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRO DE UTILIZADOR */}
      {showNewUserModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Cadastrar Novo Utilizador</h3>
              <button onClick={() => setShowNewUserModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); alert('Utilizador cadastrado com sucesso!'); setShowNewUserModal(false); }} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-slate-700 block mb-1">Nome Completo</label>
                <input type="text" required placeholder="Nome do profissional" className="w-full p-2 bg-slate-50 border rounded-lg" />
              </div>
              <div>
                <label className="font-medium text-slate-700 block mb-1">E-mail Profissional</label>
                <input type="email" required placeholder="email@renovaser.com" className="w-full p-2 bg-slate-50 border rounded-lg" />
              </div>
              <div>
                <label className="font-medium text-slate-700 block mb-1">Função</label>
                <select className="w-full p-2 bg-slate-50 border rounded-lg">
                  <option value="terapeuta">Terapeuta</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowNewUserModal(false)} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-1.5 bg-slate-900 text-white font-medium rounded-lg">
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}