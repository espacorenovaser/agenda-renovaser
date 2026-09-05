import React from 'react';
import { AlertTriangle, Calendar, Clock, X, Check } from 'lucide-react';
import type { PendingAction } from '../types';
import { formatDateTimeBR } from '../lib/dateUtils';

interface ConfirmationModalProps {
  action: PendingAction | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (action: PendingAction) => Promise<void>;
  isLoading: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  action,
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}) => {
  if (!isOpen || !action) return null;

  const isDelete = action.type === 'requestEventCancellation';

  return (
    <div id="modal-confirmation-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E3029]/60 backdrop-blur-xs">
      <div
        id="modal-confirmation-card"
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#E2DFD4] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isDelete ? 'bg-[#F9EFEF] text-[#A25852] border border-[#E6CBC8]' : 'bg-[#FBF8EF] text-[#9B7030] border border-[#E0D5B5]'
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-[#2E3029]">
                {isDelete ? 'Confirmar Cancelamento de Reunião' : 'Confirmar Atualização de Reunião'}
              </h3>
              <p className="text-sm text-[#76766D] mt-1 leading-relaxed">
                {isDelete
                  ? 'Você tem certeza que deseja cancelar e remover este evento do Google Calendar? Esta ação não pode ser desfeita.'
                  : 'Confirme as alterações solicitadas para este evento no Google Calendar:'}
              </p>
            </div>
          </div>

          <div className="mt-5 p-4 rounded-xl bg-[#FAF9F5] border border-[#E2DFD4] text-sm space-y-2">
            <div className="flex items-center space-x-2 font-medium text-[#2E3029]">
              <Calendar className="w-4 h-4 text-[#5C6B5A]" />
              <span>{action.args.eventTitle}</span>
            </div>

            {action.args.startDateTime && (
              <div className="flex items-center space-x-2 text-[#76766D] text-xs">
                <Clock className="w-3.5 h-3.5 text-[#8C9484]" />
                <span>Horário atual: {formatDateTimeBR(action.args.startDateTime)}</span>
              </div>
            )}

            {!isDelete && action.args.newStartDateTime && (
              <div className="pt-2 border-t border-[#E2DFD4] text-xs text-[#5C6B5A] font-medium">
                <strong>Novo horário:</strong> {formatDateTimeBR(action.args.newStartDateTime)}
              </div>
            )}

            {!isDelete && action.args.newTitle && (
              <div className="text-xs text-[#4A4A43]">
                <strong>Novo título:</strong> {action.args.newTitle}
              </div>
            )}

            {!isDelete && action.args.newAttendees && action.args.newAttendees.length > 0 && (
              <div className="text-xs text-[#76766D]">
                <strong>Participantes:</strong> {action.args.newAttendees.join(', ')}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#FAF9F5] px-6 py-4 border-t border-[#E2DFD4] flex justify-end space-x-3">
          <button
            id="btn-modal-cancel"
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-[#4A4A43] bg-white border border-[#E2DFD4] rounded-lg hover:bg-[#EDEBE1] transition-colors disabled:opacity-50 cursor-pointer"
          >
            Voltar / Manter
          </button>
          <button
            id="btn-modal-confirm"
            type="button"
            onClick={() => onConfirm(action)}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 cursor-pointer ${
              isDelete ? 'bg-[#A25852] hover:bg-[#88423D]' : 'bg-[#5C6B5A] hover:bg-[#4C594A]'
            }`}
          >
            {isLoading ? (
              <span>Executando...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{isDelete ? 'Sim, Cancelar Evento' : 'Sim, Atualizar Evento'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
