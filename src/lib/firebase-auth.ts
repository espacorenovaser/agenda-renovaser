import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import { clearStoredToken, getStoredToken, setCachedToken } from './google-calendar-token';

const googleProvider = new GoogleAuthProvider();

googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleProvider.setCustomParameters({
  prompt: 'select_account',
  access_type: 'offline',
});

export { onAuthStateChanged };

export function listenAuthChanges(
  onSignedIn: (user: User, token: string | null) => void,
  onSignedOut: () => void
) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      clearStoredToken();
      onSignedOut();
      return;
    }

    onSignedIn(user, getStoredToken());
  });
}

export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);

  if (!credential?.accessToken) {
    throw new Error('Google access token not returned.');
  }

  setCachedToken(credential.accessToken);
  return { user: result.user, accessToken: credential.accessToken };
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
  clearStoredToken();
}
