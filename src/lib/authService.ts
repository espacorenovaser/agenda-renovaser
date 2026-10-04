import { supabase } from './supabase';
import { clearStoredToken } from './google-calendar-token';
import type { TherapistUser } from '../types';

export function mapAuthUserToTherapistUser(user: any): TherapistUser {
  return {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
    email: user.email || '',
    role: user.user_metadata?.role || 'terapeuta',
    technique: user.user_metadata?.technique,
    createdAt: user.created_at,
  };
}

export function clearLegacyLocalAuth(): void {
  try {
    const legacyKeys = ['renovaser_active_user_v4', 'renovaser_cached_therapists_v2'];
    for (const key of legacyKeys) {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage indisponível
  }
}

export async function login(email: string, password: string): Promise<TherapistUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error('Nenhum usuário retornado');

  return mapAuthUserToTherapistUser(data.user);
}

export async function register(
  email: string,
  password: string,
  displayName?: string
): Promise<TherapistUser> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: displayName,
      },
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error('Nenhum usuário retornado');

  return mapAuthUserToTherapistUser(data.user);
}

export async function logout(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } finally {
    clearStoredToken();
  }
}

export async function signInWithGoogleCalendar(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar',
      redirectTo: window.location.origin,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
}

export function onAuthChange(callback: (user: TherapistUser | null) => void) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    callback(session?.user ? mapAuthUserToTherapistUser(session.user) : null);
  }).catch(() => callback(null));

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? mapAuthUserToTherapistUser(session.user) : null);
  });

  return () => subscription.unsubscribe();
}

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) throw error;
}

export async function getCurrentUser(): Promise<TherapistUser | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  return mapAuthUserToTherapistUser(user);
}