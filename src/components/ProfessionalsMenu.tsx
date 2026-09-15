import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Users,
  User,
  Check,
  Search,
  ChevronDown,
  X,
  Briefcase,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { AppUser, CalendarEvent } from '../types';
import { getRegisteredUsers, type AppUserWithAuth } from '../lib/renovaserAuth';

interface ProfessionalsMenuProps {
  selectedProfessionalEmail: string | 'all';
  onSelectProfessional: (user: AppUser | null) => void;
  events: CalendarEvent[];
  activeUser: AppUser | null;
}

export const ProfessionalsMenu: React.FC<ProfessionalsMenuProps> = ({
  selectedProfessionalEmail,
  onSelectProfessional,
  events,
  activeUser,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<AppUserWithAuth[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load all registered users (professionals + admins)
  useEffect(() => {
    setUsers(getRegisteredUsers());
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Separate professionals and admins
  const professionals = useMemo(() => {
    return users.filter((u) => u.role === 'professional');
  }, [users]);

  const admins = useMemo(() => {
    return users.filter((u) => u.role === 'admin');
  }, [users]);

  // Filter based on search query
  const filteredProfessionals = useMemo(() => {
    if (!searchQuery.trim()) return professionals;
    const q = searchQuery.toLowerCase();
    return professionals.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.specialty && p.specialty.toLowerCase().includes(q))
    );
  }, [professionals, searchQuery]);

  const filteredAdmins = useMemo(() => {
    if (!searchQuery.trim()) return admins;
    const q = searchQuery.toLowerCase();
    return admins.filter(
      (a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    );
  }, [admins, searchQuery]);

  // Calculate event counts per professional
  const getEventCount = (userEmail: string, userName: string) => {
    const emailLower = userEmail.toLowerCase();
    const nameLower = userName.toLowerCase();
    return events.filter((e) => {
      const inAttendees = e.attendees?.some((att) => att.toLowerCase().includes(emailLower));
      const inTitle = e.title?.toLowerCase().includes(nameLower);
      const inDesc =
        e.description?.toLowerCase().includes(emailLower) ||
        e.description?.toLowerCase().includes(nameLower);
      const isOwner =
        (e as any).professionalEmail?.toLowerCase() === emailLower ||
        (e as any).professionalName?.toLowerCase().includes(nameLower);
      return inAttendees || inTitle || inDesc || isOwner;
    }).length;
  };

  // Find currently selected professional object
  const selectedUser = useMemo(() => {
    if (selectedProfessionalEmail === 'all') return null;
    return users.find((u) => u.email.toLowerCase() === selectedProfessionalEmail.toLowerCase()) || null;
  }, [users, selectedProfessionalEmail]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        id="btn-professionals-menu"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center space-x-2 border cursor-pointer ${
          selectedProfessionalEmail !== 'all'
            ? 'bg-[#3D5A3F] text-white border-[#3D5A3F] shadow-xs'
            : 'bg-white text-[#2E3029] border-[#E2DFD4] hover:bg-[#FAF9F5] shadow-2xs'
        }`}
        title="Clique para selecionar e visualizar a agenda de um profissional específico"
      >
        <div
          className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold ${
            selectedProfessionalEmail !== 'all'
              ? 'bg-white/20 text-white'
              : 'bg-[#EDEBE1] text-[#5C6B5A]'
          }`}
        >
          {selectedUser ? (
            selectedUser.name.slice(0, 2).toUpperCase()
          ) : (
            <Users className="w-3.5 h-3.5" />
          )}
        </div>

        <div className="flex items-center space-x-1.5 text-left">
          <span className="opacity-80">Agenda:</span>
          <span className="font-semibold max-w-[140px] sm:max-w-[180px] truncate">
            {selectedUser ? selectedUser.name : 'Todos os Profissionais'}
          </span>
        </div>

        {selectedUser && selectedUser.specialty && (
          <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 rounded bg-white/20 text-white font-normal">
            {selectedUser.specialty}
          </span>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 opacity-70 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          id="professionals-dropdown-panel"
          className="absolute left-0 sm:right-auto sm:left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-[#DCD8CD] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-3 bg-[#FAF9F5] border-b border-[#EDEBE1] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-[#5C6B5A]" />
              <div>
                <h4 className="text-xs font-semibold text-[#2E3029]">
                  Visualizar Agenda por Profissional
                </h4>
                <p className="text-[10px] text-[#76766D]">
                  Selecione para filtrar os atendimentos da sala
                </p>
              </div>
            </div>
            {selectedProfessionalEmail !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  onSelectProfessional(null);
                  setIsOpen(false);
                }}
                className="text-[11px] text-[#5C6B5A] hover:text-[#3D473B] font-medium hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Limpar filtro</span>
              </button>
            )}
          </div>

          {/* Quick Search */}
          <div className="p-2.5 border-b border-[#EDEBE1] bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8C8C80] absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar profissional ou especialidade..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E2DFD4] bg-[#FAF9F5] text-[#2E3029] focus:bg-white focus:outline-none focus:border-[#5C6B5A] placeholder:text-[#8C8C80]"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-[#8C8C80] hover:text-[#2E3029]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* List options */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
            {/* Option: Todos os Profissionais */}
            <button
              type="button"
              onClick={() => {
                onSelectProfessional(null);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                selectedProfessionalEmail === 'all'
                  ? 'bg-[#E8EFE9] text-[#3D5A3F] font-semibold'
                  : 'text-[#2E3029] hover:bg-[#FAF9F5]'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#5C6B5A] text-white flex items-center justify-center font-bold text-xs">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold">Todos os Profissionais</div>
                  <div className="text-[10px] text-[#76766D]">
                    Visão geral completa da sala do instituto
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EDEBE1] text-[#4A4A43] font-mono">
                  {events.length}
                </span>
                {selectedProfessionalEmail === 'all' && (
                  <Check className="w-4 h-4 text-[#3D5A3F]" />
                )}
              </div>
            </button>

            {/* Section: Profissionais de Atendimento */}
            {filteredProfessionals.length > 0 && (
              <div className="pt-2">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#76766D] flex items-center space-x-1.5">
                  <Briefcase className="w-3 h-3 text-[#5C6B5A]" />
                  <span>Profissionais de Atendimento</span>
                </div>
                {filteredProfessionals.map((prof) => {
                  const isSelected =
                    selectedProfessionalEmail.toLowerCase() === prof.email.toLowerCase();
                  const count = getEventCount(prof.email, prof.name);

                  return (
                    <button
                      key={prof.id}
                      type="button"
                      onClick={() => {
                        onSelectProfessional(prof);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#E8EFE9] text-[#3D5A3F] font-semibold'
                          : 'text-[#2E3029] hover:bg-[#FAF9F5]'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#EDEBE1] text-[#3D5A3F] flex items-center justify-center font-bold text-[11px] shrink-0 border border-[#DCD8CD]">
                          {prof.name.replace('Dr. ', '').replace('Dra. ', '').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate flex items-center space-x-1.5">
                            <span className="truncate">{prof.name}</span>
                            {prof.specialty && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#EBF0E9] text-[#3D5A3F] border border-[#C2D6C0] font-normal shrink-0">
                                {prof.specialty}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#76766D] truncate">{prof.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 ml-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                            count > 0
                              ? 'bg-[#EBF0E9] text-[#3D5A3F] font-medium'
                              : 'bg-[#EDEBE1] text-[#8C8C80]'
                          }`}
                          title={`${count} atendimento(s) agendado(s)`}
                        >
                          {count}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-[#3D5A3F]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Section: Administradores */}
            {filteredAdmins.length > 0 && (
              <div className="pt-2">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#76766D] flex items-center space-x-1.5">
                  <ShieldCheck className="w-3 h-3 text-[#5C6B5A]" />
                  <span>Administradores (Acesso Total)</span>
                </div>
                {filteredAdmins.map((adm) => {
                  const isSelected =
                    selectedProfessionalEmail.toLowerCase() === adm.email.toLowerCase();
                  const count = getEventCount(adm.email, adm.name);

                  return (
                    <button
                      key={adm.id}
                      type="button"
                      onClick={() => {
                        onSelectProfessional(adm);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#E8EFE9] text-[#3D5A3F] font-semibold'
                          : 'text-[#2E3029] hover:bg-[#FAF9F5]'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#556553] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                          {adm.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate flex items-center space-x-1.5">
                            <span className="truncate">{adm.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#EDEBE1] text-[#556553] font-normal shrink-0">
                              Admin
                            </span>
                          </div>
                          <div className="text-[10px] text-[#76766D] truncate">{adm.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 ml-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                            count > 0
                              ? 'bg-[#EBF0E9] text-[#3D5A3F] font-medium'
                              : 'bg-[#EDEBE1] text-[#8C8C80]'
                          }`}
                        >
                          {count}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-[#3D5A3F]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="p-2.5 bg-[#FAF9F5] border-t border-[#EDEBE1] text-[10px] text-[#76766D] flex items-center justify-between">
            <span>Instituto RenovaSer</span>
            <span className="font-mono">Fuso: GMT-3 (SP)</span>
          </div>
        </div>
      )}
    </div>
  );
};
