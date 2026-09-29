import { supabase } from './supabase';
import type { TherapistUser } from '../types';

export function mapFirebaseUserToTherapistUser(user: any): TherapistUser {
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

  return mapFirebaseUserToTherapistUser(data.user);
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

  return mapFirebaseUserToTherapistUser(data.user);
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export function onAuthChange(callback: (user: TherapistUser | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ? mapFirebaseUserToTherapistUser(session.user) : null);
  });

  return subscription;
}

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) throw error;
}

export async function getCurrentUser(): Promise<TherapistUser | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  return mapFirebaseUserToTherapistUser(user);
}