import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './firebase';
import type { TherapistUser } from '../types';

// Chaves legadas removidas — mantidas aqui apenas para limpeza única
const LEGACY_SESSION_KEYS = [
  'renovaser_active_user_v4',
  'renovaser_cached_therapists_v2',
];

export function clearLegacyLocalAuth(): void {
  try {
    for (const key of LEGACY_SESSION_KEYS) {
      localStorage.removeItem(key);
    }
    // Remove qualquer resíduo de senha em caches antigos
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('renovaser_')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw && /password/i.test(raw)) {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {
    // localStorage indisponível — nada a limpar
  }
}

// Mapeamento de e-mails para papéis enquanto não há coleção de perfis
const ADMIN_EMAILS = [
  'claudirisrael@gmail.com',
  'mmgorete00@gmail.com',
  'clecimarchioro@gmail.com',
  'espacorenovaser@gmail.com',
];

export function mapFirebaseUserToTherapistUser(fbUser: FirebaseUser): TherapistUser {
  return {
    id: fbUser.uid,
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário',
    email: fbUser.email || '',
    role: ADMIN_EMAILS.includes(fbUser.email?.toLowerCase() || '') ? 'admin' : 'terapeuta',
    createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
  };
}

export async function login(email: string, password: string): Promise<TherapistUser> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return mapFirebaseUserToTherapistUser(result.user);
}

export async function register(
  email: string,
  password: string,
  displayName?: string
): Promise<TherapistUser> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  return {
    ...mapFirebaseUserToTherapistUser(result.user),
    ...(displayName ? { name: displayName.trim() } : {}),
  };
}

export async function logout(): Promise<void> {
  clearLegacyLocalAuth();
  await signOut(auth);
}

export function onAuthChange(callback: (user: TherapistUser | null) => void) {
  return onAuthStateChanged(auth, (fbUser) => {
    callback(fbUser ? mapFirebaseUserToTherapistUser(fbUser) : null);
  });
}

export async function changePassword(newPassword: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Nenhum usuário autenticado.');
  }
  await updatePassword(currentUser, newPassword);
}

export function getCurrentUser(): TherapistUser | null {
  const fbUser = auth.currentUser;
  return fbUser ? mapFirebaseUserToTherapistUser(fbUser) : null;
}
