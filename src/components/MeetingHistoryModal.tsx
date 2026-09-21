import React from 'react';
import { History, X, CalendarCheck, CalendarX, CalendarClock, ShieldCheck } from 'lucide-react';
import type { MeetingAuditLog } from '../types';
import { formatDateTimeBR } from '../lib/dateUtils';

interface MeetingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: MeetingAuditLog[];
  isLoading: boolean;
}

export const MeetingHistoryModal: React.FC<MeetingHistoryModalProps> = ({
  isOpen,
  onClose,
  logs,
  isLoading,
}) => {
  if (!isOpen) return null;

  return (
    <div id="history-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E3029]/60 backdrop-blur-xs">
      <div
        id="history-modal-card"
        className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] shadow-2xl border border-[#E2DFD4] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E2DFD4] bg-[#FAF9F5] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EDEBE1] text-[#5C6B5A] flex items-center justify-center border border-[#DCD8CD]">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#2E3029]">Histórico de Ações da Agenda</h3>
              <p className="text-xs text-[#76766D]">Registros persistidos com segurança em nuvem</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#76766D] hover:text-[#2E3029] hover:bg-[#EDEBE1] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-[#8C8C80]">Carregando histórico...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-[#76766D] text-xs">
              <ShieldCheck className="w-8 h-8 text-[#8C9484] mx-auto mb-2" />
              <p className="font-medium text-[#2E3029]">Nenhuma ação registrada ainda.</p>
              <p className="text-[#76766D] mt-1">
                Todas as reuniões criadas, editadas ou canceladas pelo assistente são auditadas aqui.
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const isCreate = log.action === 'created';
              const isCancel = log.action === 'cancelled';

              return (
                <div
                  key={log.id}
                  className="p-3 rounded-xl border border-[#E2DFD4] bg-[#FAF9F5] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-medium text-[11px] ${
                        isCreate
                          ? 'bg-[#EBF0E9] text-[#4F6F52] border border-[#C5D8C3]'
                          : isCancel
                          ? 'bg-[#F9EFEF] text-[#A25852] border border-[#E6CBC8]'
                          : 'bg-[#EDEBE1] text-[#5C6B5A] border border-[#DCD8CD]'
                      }`}
                    >
                      {isCreate && <CalendarCheck className="w-3 h-3" />}
                      {isCancel && <CalendarX className="w-3 h-3" />}
                      {!isCreate && !isCancel && <CalendarClock className="w-3 h-3" />}
                      <span>
                        {isCreate ? 'Criado' : isCancel ? 'Cancelado' : 'Atualizado'}
                      </span>
                    </span>

                    <span className="text-[#8C8C80] text-[10px]">
                      {formatDateTimeBR(log.createdAt)}
                    </span>
                  </div>

                  <p className="font-semibold text-[#2E3029] pt-1">{log.title}</p>

                  {log.startDateTime && (
                    <p className="text-[#76766D] text-[11px]">
                      Horário do evento: {formatDateTimeBR(log.startDateTime)}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-[#E2DFD4] bg-[#FAF9F5] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-[#4A4A43] bg-white border border-[#E2DFD4] rounded-lg hover:bg-[#EDEBE1] transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
