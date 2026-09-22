import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
  signOut,
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with force long polling and ignore undefined properties for maximum sandbox/iframe reliability
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
});
export const auth = getAuth(app);

// Provider with Google Calendar scope
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.setCustomParameters({
  prompt: 'select_account',
  access_type: 'offline',
});

// Storage keys for Google OAuth token
const TOKEN_STORAGE_KEY = 'google_calendar_access_token';
const TOKEN_EXPIRY_KEY = 'google_calendar_token_expiry';

// In-memory access token cache
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const getStoredToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const expiresAtStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (token && expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      // Ensure at least 60 seconds of valid life remain
      if (Date.now() < expiresAt - 60000) {
        cachedAccessToken = token;
        return token;
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
      }
    }
  } catch (e) {
    console.warn('Erro ao ler token armazenado:', e);
  }
  return null;
};

export const setCachedToken = (token: string | null, expiresInSeconds = 3500) => {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      const expiresAt = Date.now() + expiresInSeconds * 1000;
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
  } catch (e) {
    console.warn('Erro ao salvar token:', e);
  }
};

export const clearStoredToken = () => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch (e) {
    console.warn('Erro ao limpar token:', e);
  }
};

// Error handling standard per instructions
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Authentication listeners & helpers
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = getStoredToken();
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      clearStoredToken();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso do Google.');
    }

    setCachedToken(credential.accessToken);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return getStoredToken();
};

export const logout = async () => {
  await signOut(auth);
  clearStoredToken();
};
