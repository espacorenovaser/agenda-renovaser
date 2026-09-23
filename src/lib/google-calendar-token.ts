const TOKEN_STORAGE_KEY = 'google_calendar_access_token';
const TOKEN_EXPIRY_KEY = 'google_calendar_token_expiry';
const SAFETY_MARGIN_MS = 60_000;

let cachedAccessToken: string | null = null;

export function getStoredToken(): string | null {
  if (cachedAccessToken) return cachedAccessToken;

  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRY_KEY));

    if (!token || Number.isNaN(expiresAt)) return null;
    if (Date.now() < expiresAt - SAFETY_MARGIN_MS) {
      cachedAccessToken = token;
      return token;
    }

    clearStoredToken();
  } catch (e) {
    console.warn('Failed to read stored token:', e);
  }

  return null;
}

export function setCachedToken(token: string | null, expiresInSeconds = 3500): void {
  cachedAccessToken = token;

  try {
    if (!token) {
      clearStoredToken();
      return;
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresInSeconds * 1000));
  } catch (e) {
    console.warn('Failed to save token:', e);
  }
}

export function clearStoredToken(): void {
  cachedAccessToken = null;

  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch (e) {
    console.warn('Failed to clear token:', e);
  }
}
