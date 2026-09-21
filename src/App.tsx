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
  CheckCircle2
} from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'all' | 'atendimento' | 'reuniao' | 'evento'>('all');

  // Dados mockados de exemplo para exibição na UI
  const events = [
    {
      id: '1',
      title: 'Atendimento Clínico - Dr. Lucas',
      category: 'atendimento',
      time: '14:00 - 15:00',
      location: 'Sala do Instituto RenovaSer',
      type: 'presencial',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    },
    {
      id: '2',
      title: 'Reunião com Equipe de Terapeutas',
      category: 'reuniao',
      time: '19:30 - 20:30',
      location: 'Online - Google Meet',
      type: 'online',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    {
      id: '3',
      title: 'Sábado do Cuidado',
      category: 'evento',
      time: '09:00 - 12:00 (Sábado)',
      location: 'Espaço Principal',
      type: 'presencial',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200'
    }
  ];

  const filteredEvents = activeTab === 'all' 
    ? events 
    : events.filter(e => e.category === activeTab);

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
            <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              <CalendarIcon className="w-4 h-4" />
              Sincronizar Google Agenda
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all">
              <Plus className="w-4 h-4" />
              Novo Agendamento
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Coluna Principal: Visão da Agenda */}
        <section className="lg:col-span-2 space-y-6">
          
          {/* Banner Boas-Vindas */}
          <div className="bg-gradient-to-r from-emerald-800 to-teal-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-200">Painel Geral</span>
              <h2 className="text-2xl font-bold mt-1">Transformação e Desenvolvimento Humano</h2>
              <p className="text-emerald-100 text-sm mt-1 max-w-lg">
                Acompanhe os atendimentos, reuniões de equipe e eventos agendados para hoje.
              </p>
            </div>
          </div>

          {/* Filtros da Agenda */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'atendimento', label: 'Atendimentos' },
                { id: 'reuniao', label: 'Reuniões' },
                { id: 'evento', label: 'Eventos' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">{filteredEvents.length} compromissos</span>
          </div>

          {/* Lista de Compromissos */}
          <div className="space-y-3">
            {filteredEvents.map((evt) => (
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

                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {evt.time}
                    </span>
                    <span className="flex items-center gap-1">
                      {evt.type === 'online' ? (
                        <Video className="w-3.5 h-3.5 text-blue-500" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                      {evt.location}
                    </span>
                  </div>
                </div>

                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Coluna Lateral: Assistente de Agendamento IA */}
        <aside className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col h-full min-h-[420px]">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Assistente RenovaSer</h3>
                <p className="text-[11px] text-slate-500">Agendamento por Voz ou Texto</p>
              </div>
            </div>

            {/* Chat Box Simples */}
            <div className="flex-1 my-4 space-y-3 overflow-y-auto text-xs">
              <div className="bg-slate-100 p-3 rounded-xl text-slate-700">
                Olá! Como posso ajudar na agenda hoje? Tente dizer: <br />
                <span className="font-semibold text-slate-900">"Agendar reunião com a equipe de terapeutas hoje às 19h30"</span>
              </div>
            </div>

            {/* Input Box */}
            <div className="relative pt-2">
              <input
                type="text"
                placeholder="Digite seu comando aqui..."
                className="w-full pl-3 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
              <button className="absolute right-2 top-3 text-emerald-600 hover:text-emerald-700">
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

      </main>
    </div>
  );
}