import React from 'react';
import { 
  X, 
  Clock, 
  Calendar as CalendarIcon, 
  MapPin, 
  Video, 
  User, 
  Mail, 
  Phone, 
  MessageCircle, 
  Trash2, 
  ExternalLink,
  Bell
} from 'lucide-react';
import type { Evento, TherapistUser } from '../types';

interface EventDetailsModalProps {
  event: Evento | null;
  onClose: () => void;
  onDelete: (id: string, title: string) => void;
  therapists: TherapistUser[];
}

export function EventDetailsModal({ event, onClose, onDelete, therapists }: EventDetailsModalProps) {
  if (!event) return null;

  const therapist = therapists.find((t) => t.id === event.therapistId);
  const responsibleName = therapist ? therapist.name : 'Equipe RenovaSer';
  const therapistEmail = therapist ? therapist.email : '';

  // Preparar link de WhatsApp
  const cleanPhone = (event.clientWhatsApp || '').replace(/\D/g, '');
  const formattedPhone = cleanPhone.length === 11 || cleanPhone.length === 10 ? `55${cleanPhone}` : cleanPhone;
  const whatsappMessage = encodeURIComponent(
    `Olá! Sou do Instituto RenovaSer. Lembramos do seu compromisso agendado para ${event.date} às ${event.time} (${event.title}). Local: ${event.location}. Qualquer dúvida, estamos à disposição!`
  );
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${whatsappMessage}`;

  const mailtoSubject = encodeURIComponent(`Lembrete de Compromisso: ${event.title} - Instituto RenovaSer`);
  const mailtoBody = encodeURIComponent(
    `Olá!\n\nConfirmamos o agendamento de "${event.title}" no Instituto RenovaSer.\n\nData: ${event.date}\nHorário: ${event.time}\nModalidade: ${event.type === 'online' ? 'Online' : 'Presencial'}\nLocal: ${event.location}\nResponsável: ${responsibleName}\n\nAtenciosamente,\nInstituto RenovaSer`
  );
  const mailtoUrl = `mailto:${event.clientEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200">
        
        {/* Cabeçalho do Modal */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${event.badgeColor}`}>
                {event.category.toUpperCase()}
              </span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                event.type === 'online' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {event.type === 'online' ? 'Online' : 'Presencial'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">{event.title}</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informações detalhadas do Agendamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          
          {/* Data e Horário */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-medium flex items-center gap-1.5 text-[11px]">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-500" /> Data do Agendamento
            </span>
            <p className="font-semibold text-slate-800 text-sm">{event.date}</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-medium flex items-center gap-1.5 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-slate-500" /> Horário
            </span>
            <p className="font-semibold text-slate-800 text-sm">{event.time}</p>
          </div>

          {/* Terapeuta / Responsável */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 sm:col-span-2">
            <span className="text-slate-400 font-medium flex items-center gap-1.5 text-[11px]">
              <User className="w-3.5 h-3.5 text-slate-500" /> Terapeuta / Responsável
            </span>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-800 text-sm">{responsibleName}</p>
              {therapistEmail && (
                <span className="text-slate-500 text-[11px]">{therapistEmail}</span>
              )}
            </div>
          </div>

          {/* Local ou Link */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 sm:col-span-2">
            <span className="text-slate-400 font-medium flex items-center gap-1.5 text-[11px]">
              {event.type === 'online' ? (
                <Video className="w-3.5 h-3.5 text-blue-500" />
              ) : (
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              )}
              {event.type === 'online' ? 'Link da Sala Online' : 'Local do Atendimento'}
            </span>
            <p className="font-semibold text-slate-800 break-all">{event.location}</p>
          </div>

        </div>

        {/* Notificação Antecipada / Dados do Cliente */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-700" />
              <h4 className="text-xs font-bold text-emerald-900">Notificação Antecipada do Cliente</h4>
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold">
              Lembrete Rápido
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {/* WhatsApp */}
            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-emerald-100">
              <div className="flex items-center gap-2 truncate">
                <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-slate-700">WhatsApp:</span>
                <span className="text-slate-900 font-semibold truncate">
                  {event.clientWhatsApp || 'Não informado'}
                </span>
              </div>
              {event.clientWhatsApp && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-md transition-colors shrink-0"
                >
                  <MessageCircle className="w-3 h-3" /> Notificar WhatsApp
                </a>
              )}
            </div>

            {/* E-mail */}
            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-emerald-100">
              <div className="flex items-center gap-2 truncate">
                <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="font-medium text-slate-700">E-mail:</span>
                <span className="text-slate-900 font-semibold truncate">
                  {event.clientEmail || 'Não informado'}
                </span>
              </div>
              {event.clientEmail && (
                <a
                  href={mailtoUrl}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-900 text-white px-3 py-1 rounded-md transition-colors shrink-0"
                >
                  <Mail className="w-3 h-3" /> Enviar E-mail
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé e Ações */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <button
            onClick={() => {
              onDelete(event.id, event.title);
              onClose();
            }}
            className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors font-medium"
          >
            <Trash2 className="w-4 h-4" /> Excluir Compromisso
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
