import { type User } from 'firebase/auth';
import {
  signInWithGoogle,
  signOutUser,
} from './firebase-auth';
import { getStoredToken } from './google-calendar-token';

export async function googleSignIn(): Promise<{ user: User; accessToken: string } | null> {
  return signInWithGoogle();
}

export async function getAccessToken(): Promise<string | null> {
  return getStoredToken();
}

export async function logout(): Promise<void> {
  await signOutUser();
}
