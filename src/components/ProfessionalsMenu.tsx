import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Users,
  Check,
  Search,
  ChevronDown,
  X,
  Briefcase,
  ShieldCheck,
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
        className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 border cursor-pointer ${
          selectedProfessionalEmail !== 'all'
            ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
            : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50 shadow-2xs'
        }`}
        title="Clique para selecionar e visualizar a agenda de um profissional específico"
      >
        <div
          className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold ${
            selectedProfessionalEmail !== 'all'
              ? 'bg-white/20 text-white'
              : 'bg-slate-100 text-emerald-700'
          }`}
        >
          {selectedUser ? (
            selectedUser.name.slice(0, 2).toUpperCase()
          ) : (
            <Users className="w-3.5 h-3.5" />
          )}
        </div>

        <div className="flex items-center space-x-1.5 text-left">
          <span className="opacity-75 font-normal">Agenda:</span>
          <span className="font-bold max-w-[140px] sm:max-w-[180px] truncate">
            {selectedUser ? selectedUser.name : 'Todos os Profissionais'}
          </span>
        </div>

        {selectedUser && selectedUser.specialty && (
          <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">
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
          className="absolute left-0 sm:right-auto sm:left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-emerald-700" />
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Visualizar Agenda por Profissional
                </h4>
                <p className="text-[11px] text-slate-500">
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
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Limpar filtro</span>
              </button>
            )}
          </div>

          {/* Quick Search */}
          <div className="p-2.5 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar profissional ou especialidade..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder:text-slate-400"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List options */}
          <div className="max-h-72 overflow-y-auto p-2 space-y-1">
            {/* Option: Todos os Profissionais */}
            <button
              type="button"
              onClick={() => {
                onSelectProfessional(null);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                selectedProfessionalEmail === 'all'
                  ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200'
                  : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold">Todos os Profissionais</div>
                  <div className="text-[10px] text-slate-500">
                    Visão geral de todos os atendimentos
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold border border-slate-200">
                  {events.length}
                </span>
                {selectedProfessionalEmail === 'all' && (
                  <Check className="w-4 h-4 text-emerald-700 font-bold" />
                )}
              </div>
            </button>

            {/* Section: Profissionais de Atendimento */}
            {filteredProfessionals.length > 0 && (
              <div className="pt-2">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Briefcase className="w-3 h-3 text-slate-400" />
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
                          ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200'
                          : 'text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                          {prof.name.replace('Dr. ', '').replace('Dra. ', '').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold truncate flex items-center space-x-1.5">
                            <span className="truncate">{prof.name}</span>
                            {prof.specialty && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold shrink-0">
                                {prof.specialty}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{prof.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 ml-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                            count > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                          title={`${count} atendimento(s) agendado(s)`}
                        >
                          {count}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-emerald-700" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Section: Administradores */}
            {filteredAdmins.length > 0 && (
              <div className="pt-2">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <ShieldCheck className="w-3 h-3 text-slate-400" />
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
                          ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200'
                          : 'text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {adm.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold truncate flex items-center space-x-1.5">
                            <span className="truncate">{adm.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold shrink-0">
                              Admin
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{adm.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 ml-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                            count > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-emerald-700" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
            <span className="font-medium">Instituto RenovaSer</span>
            <span className="font-mono">Fuso: GMT-3 (SP)</span>
          </div>
        </div>
      )}
    </div>
  );
};
