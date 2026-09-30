import { getStoredToken, setCachedToken, clearStoredToken } from './google-calendar-token';

export interface GoogleUser {
  email: string;
  name?: string;
}

let currentGoogleUser: GoogleUser | null = null;

export async function googleSignIn(): Promise<{ user: GoogleUser; accessToken: string } | null> {
  const token = getStoredToken();
  if (token) {
    return {
      user: currentGoogleUser || { email: 'user@example.com' },
      accessToken: token
    };
  }

  try {
    const storedToken = localStorage.getItem('google_calendar_access_token');
    if (storedToken) {
      const user: GoogleUser = {
        email: localStorage.getItem('google_user_email') || 'user@example.com',
        name: localStorage.getItem('google_user_name')
      };
      currentGoogleUser = user;
      setCachedToken(storedToken);
      return { user, accessToken: storedToken };
    }
  } catch (err) {
    console.warn('Failed to restore Google session:', err);
  }

  return null;
}

export async function googleLogout(): Promise<void> {
  clearStoredToken();
  currentGoogleUser = null;
  try {
    localStorage.removeItem('google_user_email');
    localStorage.removeItem('google_user_name');
  } catch {
    // ignore
  }
}

export async function getAccessToken(): Promise<string | null> {
  const token = getStoredToken();
  if (token) return token;

  try {
    const stored = localStorage.getItem('google_calendar_access_token');
    if (stored) {
      setCachedToken(stored);
      return stored;
    }
  } catch {
    // ignore
  }

  return null;
}

export function setGoogleUser(user: GoogleUser | null, token?: string): void {
  currentGoogleUser = user;
  if (user && token) {
    try {
      localStorage.setItem('google_user_email', user.email);
      if (user.name) localStorage.setItem('google_user_name', user.name);
      setCachedToken(token);
    } catch {
      // ignore
    }
  }
}

export function getCurrentGoogleUser(): GoogleUser | null {
  return currentGoogleUser;
}
