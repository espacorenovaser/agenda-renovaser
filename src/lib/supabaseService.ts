import { supabase } from './supabase';
import type { TherapistUser } from '../types';
import type { Event } from './supabase';

const LOCAL_EVENTS_KEY = 'renovaser_cached_events_v2';
const LOCAL_THERAPISTS_KEY = 'renovaser_cached_therapists_v2';

function stripSensitiveFields(t: any): TherapistUser {
  const { password, passwordHash, ...safe } = t ?? {};
  return safe as TherapistUser;
}

export function getCachedLocalEvents(): Event[] {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    console.warn('Erro ao ler cache local de eventos');
  }
  return [];
}

export function setCachedLocalEvents(events: Event[]): void {
  try {
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
  } catch {
    console.warn('Erro ao gravar cache local de eventos');
  }
}

export function getCachedLocalTherapists(): TherapistUser[] {
  try {
    const raw = localStorage.getItem(LOCAL_THERAPISTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(stripSensitiveFields);
    }
  } catch {
    console.warn('Erro ao ler cache local de terapeutas');
  }
  return [];
}

export function setCachedLocalTherapists(therapists: TherapistUser[]): void {
  try {
    localStorage.setItem(LOCAL_THERAPISTS_KEY, JSON.stringify(therapists.map(stripSensitiveFields)));
  } catch {
    console.warn('Erro ao gravar cache local de terapeutas');
  }
}

export function subscribeToEvents(
  callback: (events: any[]) => void,
  onError?: (err: any) => void
) {
  let cancelled = false;

  const fetchAll = async () => {
    try {
      const { data, error } = await supabase.from('events').select('*').order('start_time', { ascending: true });
      if (error) throw error;
      if (cancelled) return;
      setCachedLocalEvents(data || []);
      callback(data || []);
    } catch (err: any) {
      console.warn('Erro ao sincronizar eventos:', err);
      if (cancelled) return;
      if (onError) onError(err);
      const fallback = getCachedLocalEvents();
      if (fallback.length > 0) callback(fallback);
    }
  };

  const cached = getCachedLocalEvents();
  if (cached.length > 0) {
    callback(cached);
  }
  void fetchAll();

  const channel = supabase
    .channel('events-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
      void fetchAll();
    })
    .subscribe();

  return () => {
    cancelled = true;
    void supabase.removeChannel(channel);
  };
}

export async function saveEvent(event: any): Promise<string> {
  const eventId = event.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const payload = { ...event, id: eventId };
  const cached = getCachedLocalEvents();
  const idx = cached.findIndex((e) => e.id === eventId);
  setCachedLocalEvents(idx >= 0 ? [...cached.slice(0, idx), payload, ...cached.slice(idx + 1)] : [...cached, payload]);

  try {
    const { error } = await supabase.from('events').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  } catch (err: any) {
    console.error('Erro ao salvar evento:', err);
  }

  return eventId;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const cached = getCachedLocalEvents();
  setCachedLocalEvents(cached.filter((e) => e.id !== eventId));

  try {
    await supabase.from('events').delete().eq('id', eventId);
  } catch (err: any) {
    console.error('Erro ao excluir evento:', err);
  }
}

export function subscribeToTherapists(
  callback: (therapists: TherapistUser[]) => void,
  onError?: (err: any) => void
) {
  let cancelled = false;

  const mapProfiles = (data: any[]): TherapistUser[] =>
    (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role || 'terapeuta',
      technique: p.technique || '',
      createdAt: p.created_at,
    }));

  const fetchAll = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      if (cancelled) return;
      const therapists = mapProfiles(data || []);
      if (therapists.length > 0) {
        setCachedLocalTherapists(therapists);
        callback(therapists);
      }
    } catch (err: any) {
      console.warn('Erro ao sincronizar terapeutas:', err);
      if (cancelled) return;
      if (onError) onError(err);
    }
  };

  const cached = getCachedLocalTherapists();
  if (cached.length > 0) {
    callback(cached);
  }
  void fetchAll();

  const channel = supabase
    .channel('profiles-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      void fetchAll();
    })
    .subscribe();

  return () => {
    cancelled = true;
    void supabase.removeChannel(channel);
  };
}

export async function saveTherapist(therapist: any): Promise<string> {
  const userId = therapist.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const cached = getCachedLocalTherapists();
  const idx = cached.findIndex((t) => t.id === userId || t.email.toLowerCase() === therapist.email.toLowerCase());
  const dataToSave = { id: userId, ...therapist };
  setCachedLocalTherapists(idx >= 0 ? [...cached.slice(0, idx), dataToSave, ...cached.slice(idx + 1)] : [...cached, dataToSave]);

  try {
    await supabase.from('profiles').upsert({
      id: userId,
      name: therapist.name,
      email: therapist.email,
      role: therapist.role || 'terapeuta',
    }, { onConflict: 'id' });
  } catch (err: any) {
    console.error('Erro ao salvar terapeuta:', err);
  }

  return userId;
}

export async function deleteTherapist(therapistId: string): Promise<void> {
  const cached = getCachedLocalTherapists();
  setCachedLocalTherapists(cached.filter((t) => t.id !== therapistId));

  try {
    await supabase.from('profiles').delete().eq('id', therapistId);
  } catch (err: any) {
    console.error('Erro ao excluir terapeuta:', err);
  }
}

export const DEFAULT_THERAPISTS: TherapistUser[] = [
  { id: 'admin1', name: 'Administrador RenovaSer', email: 'admin.renovaser@exemplo.com', role: 'admin' },
  { id: 'admin2', name: 'Maria Gestora', email: 'admin2.renovaser@exemplo.com', role: 'admin' },
  { id: 'admin3', name: 'Cleci Coordenadora', email: 'admin3.renovaser@exemplo.com', role: 'admin' },
  { id: 'admin4', name: 'Espaço Exemplo', email: 'espaco.exemplo@exemplo.com', role: 'admin' },
  { id: 'terapeuta1', name: 'Dr. Lucas Silva', email: 'terapeuta.silva@exemplo.com', role: 'terapeuta', technique: 'Psicoterapia' },
  { id: 'terapeuta2', name: 'Dra. Adriana Souza', email: 'terapeuta.souza@exemplo.com', role: 'terapeuta', technique: 'Tarô' },
];

export const DEFAULT_EVENTS: any[] = [];
