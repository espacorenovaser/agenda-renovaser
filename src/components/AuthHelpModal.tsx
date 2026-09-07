import React from 'react';
import {
  ExternalLink,
  AlertTriangle,
  X,
  Sparkles,
  ShieldCheck,
  Globe,
  HelpCircle,
} from 'lucide-react';

interface AuthHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  code?: string;
  isIframe?: boolean;
  onActivateDemoMode?: () => void;
}

export const AuthHelpModal: React.FC<AuthHelpModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  code,
  isIframe,
  onActivateDemoMode,
}) => {
  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleOpenNewTab = () => {
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E241D]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-[#E2DFD4] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-[#FAF9F5] border-b border-[#E2DFD4] flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#FDF6E2] text-[#8C6D23] border border-[#E8D9A8] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#2E3029]">{title}</h3>
              <p className="text-xs text-[#76766D]">Autenticação Google Agenda • Instituto RenovaSer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#76766D] hover:text-[#2E3029] p-1.5 rounded-lg hover:bg-[#EDEBE1] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-sm text-[#4A4A43]">
          <div className="p-3.5 bg-[#FAF9F5] rounded-xl border border-[#E2DFD4] text-xs leading-relaxed">
            <p className="text-[#2E3029] font-medium mb-1">Situação identificada:</p>
            <p className="text-[#55554D]">{message}</p>
          </div>

          {/* Explanation for Iframe and Browsers */}
          <div className="space-y-2 text-xs text-[#55554D] leading-relaxed">
            <div className="flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 text-[#5C6B5A] shrink-0 mt-0.5" />
              <span>
                <strong>Por que isso acontece no preview?</strong> Por regras rigorosas de segurança dos navegadores
                (Chrome, Safari, Edge), janelas pop-up de login da Google são bloqueadas quando o site está embutido dentro de
                um iframe (como a área de visualização do AI Studio).
              </span>
            </div>

            <div className="flex items-start space-x-2">
              <Globe className="w-4 h-4 text-[#5C6B5A] shrink-0 mt-0.5" />
              <span>
                <strong>Em produção no seu domínio oficial:</strong> No seu endereço{' '}
                <code className="px-1.5 py-0.5 bg-[#EDEBE1] rounded text-[#2E3029] font-mono text-[11px]">
                  agenda.institutorenovaser.com.br
                </code>
                , o login com Google funciona sem essa limitação, bastando mantê-lo autorizado no Firebase Console.
              </span>
            </div>
          </div>

          {code && (
            <div className="text-[11px] text-[#76766D] font-mono bg-[#F2EFEB] px-2.5 py-1.5 rounded-lg truncate">
              Código técnico: {code}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#FAF9F5] border-t border-[#E2DFD4] flex flex-col sm:flex-row items-center justify-end gap-2">
          {onActivateDemoMode && (
            <button
              type="button"
              onClick={() => {
                onActivateDemoMode();
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-[#C2D6C0] bg-white hover:bg-[#EBF0E9] text-[#3D5A3F] text-xs font-medium transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#4F6F52]" />
              <span>Ver Agenda de Demonstração</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenNewTab}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#5C6B5A] hover:bg-[#4A5748] text-white text-xs font-medium shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir em Nova Aba</span>
          </button>
        </div>
      </div>
    </div>
  );
};
