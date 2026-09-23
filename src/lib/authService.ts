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

// Mapeamento temporário de e-mails para papéis enquanto não há coleção de perfis
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
  const result = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
  return mapFirebaseUserToTherapistUser(result.user);
}

export async function register(email: string, password: string): Promise<TherapistUser> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
  return mapFirebaseUserToTherapistUser(result.user);
}

export async function logout(): Promise<void> {
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
