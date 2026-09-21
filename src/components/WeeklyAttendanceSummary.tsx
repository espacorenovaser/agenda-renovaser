import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';
import {
  BarChart3,
  CalendarDays,
  UserCheck,
  Users,
  Sparkles,
  ArrowDown,
  TrendingUp,
  Clock,
  Layers
} from 'lucide-react';
import type { Evento, TherapistUser } from '../types';

interface WeeklyAttendanceSummaryProps {
  events: Evento[];
  therapists: TherapistUser[];
  onSelectCategory?: (category: 'all' | 'atendimento' | 'reuniao' | 'evento') => void;
  onScrollToTop?: () => void;
}

export const WeeklyAttendanceSummary: React.FC<WeeklyAttendanceSummaryProps> = ({
  events,
  therapists,
  onSelectCategory,
  onScrollToTop
}) => {
  const [chartView, setChartView] = useState<'total' | 'diario'>('total');

  // Calcular limites da semana atual (Segunda-feira até Domingo)
  const { mondayStr, sundayStr, formattedRange, weekDays } = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Domingo, 1 = Segunda
    const diffToMonday = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    
    const monday = new Date(now.setDate(diffToMonday));
    const mondayIso = monday.toISOString().split('T')[0];
    
    const days: { dateStr: string; label: string; shortName: string }[] = [];
    const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      days.push({
        dateStr: iso,
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        shortName: dayNames[i]
      });
    }

    const sundayIso = days[6].dateStr;
    const formatted = `${days[0].label} a ${days[6].label}`;

    return {
      mondayStr: mondayIso,
      sundayStr: sundayIso,
      formattedRange: formatted,
      weekDays: days
    };
  }, []);

  // Filtrar eventos da semana atual
  const weekEvents = useMemo(() => {
    return events.filter((e) => e.date >= mondayStr && e.date <= sundayStr);
  }, [events, mondayStr, sundayStr]);

  // Contagem por categoria na semana
  const stats = useMemo(() => {
    let atendimentos = 0;
    let reunioes = 0;
    let eventos = 0;

    weekEvents.forEach((evt) => {
      if (evt.category === 'atendimento') atendimentos++;
      else if (evt.category === 'reuniao') reunioes++;
      else if (evt.category === 'evento') eventos++;
    });

    const total = atendimentos + reunioes + eventos;
    const percentAtendimentos = total > 0 ? Math.round((atendimentos / total) * 100) : 0;

    return {
      atendimentos,
      reunioes,
      eventos,
      total,
      percentAtendimentos
    };
  }, [weekEvents]);

  // Dados para o Gráfico de Barras por Categoria (Total da Semana)
  const categoryChartData = useMemo(() => {
    return [
      {
        name: 'Atendimentos',
        id: 'atendimento',
        quantidade: stats.atendimentos,
        color: '#059669', // Emerald
        bgColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        descricao: 'Atendimentos clínicos individuais e familiares'
      },
      {
        name: 'Reuniões',
        id: 'reuniao',
        quantidade: stats.reunioes,
        color: '#2563eb', // Blue
        bgColor: 'bg-blue-50 text-blue-800 border-blue-200',
        descricao: 'Alinhamentos pedagógicos e de equipe'
      },
      {
        name: 'Eventos',
        id: 'evento',
        quantidade: stats.eventos,
        color: '#d97706', // Amber
        bgColor: 'bg-amber-50 text-amber-800 border-amber-200',
        descricao: 'Workshops, palestras e grupos terapêuticos'
      }
    ];
  }, [stats]);

  // Dados para o Gráfico de Barras Diário da Semana (distribuído por dia)
  const dailyChartData = useMemo(() => {
    return weekDays.map((day) => {
      const dayEvts = weekEvents.filter((e) => e.date === day.dateStr);
      const atend = dayEvts.filter((e) => e.category === 'atendimento').length;
      const reun = dayEvts.filter((e) => e.category === 'reuniao').length;
      const evnt = dayEvts.filter((e) => e.category === 'evento').length;

      return {
        dia: `${day.shortName} (${day.label})`,
        Atendimentos: atend,
        Reuniões: reun,
        Eventos: evnt,
        total: atend + reun + evnt
      };
    });
  }, [weekDays, weekEvents]);

  // Custom Tooltip para o Gráfico de Categorias
  const CustomCategoryTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
          <div className="flex items-center gap-2 font-bold">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            <span>{data.name}</span>
          </div>
          <p className="text-sm font-semibold text-slate-100">
            {data.quantidade} compromisso{data.quantidade === 1 ? '' : 's'} na semana
          </p>
          <p className="text-[11px] text-slate-300">{data.descricao}</p>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip para o Gráfico Diário
  const CustomDailyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700">
          <p className="font-bold border-b border-slate-700 pb-1 text-slate-200">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-300">{entry.name}:</span>
              </span>
              <span className="font-bold text-white">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <section 
      id="resumo-atendimentos" 
      className="scroll-mt-20 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 transition-all"
    >
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Resumo de Atendimentos</h2>
              <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                Esta Semana ({formattedRange})
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento gráfico e comparativo dos atendimentos, reuniões e eventos registrados.
            </p>
          </div>
        </div>

        {/* Controles e Alternador de Gráficos */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setChartView('total')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                chartView === 'total'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por Categoria
            </button>
            <button
              onClick={() => setChartView('diario')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                chartView === 'diario'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Distribuição Diária
            </button>
          </div>

          {onScrollToTop && (
            <button
              onClick={onScrollToTop}
              title="Voltar ao topo da agenda"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowDown className="w-4 h-4 rotate-180" />
            </button>
          )}
        </div>
      </div>

      {/* Cartões de Indicadores Rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Geral */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total na Semana</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Compromissos agendados</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-200/60 flex items-center justify-center text-slate-700">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Atendimentos Clínicos */}
        <div 
          onClick={() => onSelectCategory && onSelectCategory('atendimento')}
          className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-emerald-50 transition-colors group"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Atendimentos</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{stats.atendimentos}</p>
            <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
              {stats.percentAtendimentos}% do volume total
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Reuniões */}
        <div 
          onClick={() => onSelectCategory && onSelectCategory('reuniao')}
          className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-blue-50 transition-colors group"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-800">Reuniões</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{stats.reunioes}</p>
            <p className="text-[10px] text-blue-600 font-medium mt-0.5">Equipe e alinhamentos</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Eventos e Cursos */}
        <div 
          onClick={() => onSelectCategory && onSelectCategory('evento')}
          className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-amber-50 transition-colors group"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Eventos</p>
            <p className="text-2xl font-bold text-amber-900 mt-1">{stats.eventos}</p>
            <p className="text-[10px] text-amber-600 font-medium mt-0.5">Workshops e palestras</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ÁREA DO GRÁFICO RECHARTS */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {chartView === 'total' 
                ? 'Volume Semanal por Categoria' 
                : 'Distribuição Diária na Semana (Segunda a Domingo)'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {chartView === 'total'
                ? 'Gráfico de barras comparando a quantidade de atendimentos, reuniões e eventos.'
                : 'Frequência diária de compromissos ao longo dos 7 dias da semana.'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded bg-emerald-600" /> Atendimento
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded bg-blue-600" /> Reunião
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded bg-amber-500" /> Evento
            </span>
          </div>
        </div>

        {/* Componente Recharts */}
        <div className="w-full h-72">
          {stats.total === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
              <CalendarDays className="w-8 h-8 text-slate-300" />
              <span>Nenhum atendimento ou evento cadastrado para a semana atual ({formattedRange}).</span>
            </div>
          ) : chartView === 'total' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryChartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
                barSize={56}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis 
                  allowDecimals={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomCategoryTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar 
                  dataKey="quantidade" 
                  radius={[8, 8, 0, 0]}
                  name="Quantidade"
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dailyChartData}
                margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="dia" 
                  tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis 
                  allowDecimals={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomDailyTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                />
                <Bar dataKey="Atendimentos" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Reuniões" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Eventos" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Rodapé com Destaques Informativos */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-emerald-600" />
          <span>Os dados são atualizados automaticamente em tempo real com o banco de dados.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">
            Profissionais ativos: <strong>{therapists.length}</strong>
          </span>
        </div>
      </div>
    </section>
  );
};
