/**
 * Google Calendar Authentication Service (Supabase-compatible stubs)
 *
 * Note: Full OAuth2 implementation with Google Identity Services (GIS) is pending.
 * For now, this provides fallback stubs to prevent import errors.
 * TODO: Implement proper GIS integration or remove Google Calendar sync
 */

export interface GoogleUser {
  email: string;
  name: string;
}

export interface GoogleAuthResponse {
  user: GoogleUser;
  accessToken: string;
}

/**
 * Initialize Google authentication listener
 * Currently a stub - returns empty unsubscribe function
 * @param onAuthSuccess - Callback when user authenticates
 * @param onAuthLogout - Callback when user logs out
 * @returns Unsubscribe function
 */
export function initAuth(
  onAuthSuccess?: (user: GoogleUser, token: string) => void,
  onAuthLogout?: () => void
): () => void {
  console.warn('Google Auth not yet configured for Supabase. Implement GIS integration.');
  return () => {
    // Stub unsubscribe
  };
}

/**
 * Sign in with Google
 * Currently a stub - returns null
 * @returns Promise resolving to auth response or null
 */
export async function googleSignIn(): Promise<GoogleAuthResponse | null> {
  console.warn('Google Sign In not implemented. Please implement GIS integration.');
  return null;
}

/**
 * Sign out from Google
 * Currently a stub
 */
export async function googleLogout(): Promise<void> {
  console.warn('Google Sign Out not implemented.');
}

/**
 * Get the current access token for Google Calendar API
 * Currently a stub - returns null
 * @returns Promise resolving to token or null
 */
export async function getAccessToken(): Promise<string | null> {
  console.warn('Google access token not available. Implement GIS integration.');
  return null;
}

