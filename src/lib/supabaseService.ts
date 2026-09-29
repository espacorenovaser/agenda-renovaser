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
  const localInitial = getCachedLocalEvents();
  if (localInitial.length > 0) callback(localInitial);

  supabase
    .channel('events-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, async () => {
      try {
        const { data, error } = await supabase.from('events').select('*').order('start_time', { ascending: true });
        if (error) throw error;
        setCachedLocalEvents(data || []);
        callback(data || []);
      } catch (err: any) {
        console.warn('Erro ao sincronizar eventos:', err);
        if (onError) onError(err);
        callback(getCachedLocalEvents());
      }
    })
    .subscribe();

  return () => {};
}

export async function saveEvent(event: any): Promise<string> {
  const eventId = event.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cached = getCachedLocalEvents();
  const idx = cached.findIndex((e) => e.id === eventId);
  setCachedLocalEvents(idx >= 0 ? [...cached.slice(0, idx), event, ...cached.slice(idx + 1)] : [...cached, event]);

  try {
    const { error } = await supabase.from('events').upsert(event, { onConflict: 'id' });
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
  const localInitial = getCachedLocalTherapists();
  if (localInitial.length > 0) callback(localInitial);

  supabase
    .channel('profiles-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        const therapists = (data || []).map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          role: p.role || 'terapeuta',
          technique: '',
          createdAt: p.created_at,
        }));
        setCachedLocalTherapists(therapists);
        callback(therapists);
      } catch (err: any) {
        console.warn('Erro ao sincronizar terapeutas:', err);
        if (onError) onError(err);
        callback(getCachedLocalTherapists());
      }
    })
    .subscribe();

  return () => {};
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

export async function syncUserProfile(user: any) {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.uid).single();
    if (error || !data) {
      const newProfile = {
        id: user.uid,
        name: user.displayName || 'Usuário da Equipe',
        email: user.email || '',
        role: 'terapeuta',
        created_at: new Date().toISOString(),
      };
      await supabase.from('profiles').insert(newProfile);
      return newProfile;
    }
    return data;
  } catch (err: any) {
    console.warn('Could not sync user profile:', err);
  }
}

export async function saveChatMessage(userId: string, message: any): Promise<string | undefined> {
  try {
    const { data, error } = await supabase.from('chat_messages').insert({
      user_id: userId,
      sender: message.role,
      content: message.content,
    }).select().single();
    if (error) throw error;
    return data?.id;
  } catch (err: any) {
    console.warn('Could not save chat message:', err);
  }
}

export function subscribeToMessages(userId: string, callback: (msgs: any[]) => void, onError?: (err: any) => void) {
  supabase
    .channel(`messages-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${userId}` }, async () => {
      try {
        const { data, error } = await supabase.from('chat_messages').select('*').eq('user_id', userId).order('created_at', { ascending: true }).limit(50);
        if (error) throw error;
        callback(data || []);
      } catch (err: any) {
        if (onError) onError(err);
      }
    })
    .subscribe();

  return () => {};
}

export async function clearChatMessages(userId: string): Promise<void> {
  try {
    await supabase.from('chat_messages').delete().eq('user_id', userId);
  } catch (err: any) {
    console.warn('Could not clear chat messages:', err);
  }
}

export async function logMeetingAction(userId: string, log: any): Promise<string | undefined> {
  try {
    const { data, error } = await supabase.from('chat_messages').insert({
      user_id: userId,
      sender: 'user',
      content: log.title,
    }).select().single();
    if (error) throw error;
    return data?.id;
  } catch (err: any) {
    console.warn('Could not log meeting action:', err);
  }
}

export async function getRecentMeetingLogs(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase.from('chat_messages').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return data || [];
  } catch (err: any) {
    console.warn('Could not fetch meeting logs:', err);
    return [];
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
