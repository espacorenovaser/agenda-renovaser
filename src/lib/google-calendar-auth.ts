import { supabase } from './supabase';
import { getStoredToken, setCachedToken, clearStoredToken } from './google-calendar-token';

export interface GoogleUser {
  email: string;
  name: string;
}

function supabaseUserToGoogleUser(user: any): GoogleUser {
  return {
    email: user?.email || '',
    name: user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário',
  };
}

/**
 * Initialize Google authentication listener backed by Supabase Auth.
 * Hydrates the cached provider token from the active Supabase session
 * (session.provider_token) so Google Calendar API calls can authenticate.
 */
export function initAuth(
  onAuthSuccess?: (user: GoogleUser, token: string) => void,
  onAuthLogout?: () => void
): () => void {
  // Hydrate from current session immediately.
  supabase.auth.getSession().then(({ data: { session } }) => {
    const token = session?.provider_token;
    if (session?.user && token) {
      setCachedToken(token);
      onAuthSuccess?.(supabaseUserToGoogleUser(session.user), token);
    } else if (!session?.user) {
      onAuthLogout?.();
    }
  }).catch(() => {});

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user && session.provider_token) {
      setCachedToken(session.provider_token);
      onAuthSuccess?.(supabaseUserToGoogleUser(session.user), session.provider_token);
    } else if (!session) {
      clearStoredToken();
      onAuthLogout?.();
    }
  });

  return () => subscription.unsubscribe();
}

/**
 * Get the Google Calendar access token for API calls.
 * Reads the active Supabase session's provider_token (caching it in
 * localStorage), falling back to the previously cached token.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;
    if (providerToken) {
      const expiresIn = (session as any)?.expires_in ?? 3500;
      setCachedToken(providerToken, typeof expiresIn === 'number' ? expiresIn : 3500);
      return providerToken;
    }
  } catch (e) {
    console.warn('Failed to read Supabase session for Google token:', e);
  }
  return getStoredToken();
}
