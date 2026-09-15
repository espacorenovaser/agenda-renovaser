import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type { ChatMessage, MeetingAuditLog, UserProfile } from '../types';

export async function syncUserProfile(user: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null }) {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const newProfile: Record<string, any> = {
        id: user.uid,
        displayName: user.displayName || 'Usuário da Equipe',
        email: user.email || '',
        timeZone: 'America/Sao_Paulo',
        defaultMeetingDurationMinutes: 60,
        createdAt: new Date().toISOString(),
      };
      if (user.photoURL) {
        newProfile.photoURL = user.photoURL;
      }
      await setDoc(userRef, newProfile);
      return newProfile as UserProfile;
    }
    return snap.data() as UserProfile;
  } catch (err: any) {
    const isPerm =
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission-denied') ||
      err?.message?.includes('Missing or insufficient permissions');

    if (isPerm) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.warn('Could not sync user profile in Firestore (offline/transient):', err?.message || err);
    return {
      id: user.uid,
      displayName: user.displayName || 'Usuário da Equipe',
      email: user.email || '',
      photoURL: user.photoURL || undefined,
      timeZone: 'America/Sao_Paulo',
      defaultMeetingDurationMinutes: 60,
      createdAt: new Date().toISOString(),
    };
  }
}

export async function saveChatMessage(userId: string, message: Omit<ChatMessage, 'id'>): Promise<string | undefined> {
  const path = `users/${userId}/chat_messages`;
  try {
    const colRef = collection(db, 'users', userId, 'chat_messages');
    const docData: Record<string, any> = {
      role: message.role,
      content: message.content,
      userId,
      createdAt: message.createdAt || new Date().toISOString(),
    };
    if (message.pendingActions && message.pendingActions.length > 0) {
      docData.pendingActions = message.pendingActions;
    }
    if (message.executedEvents && message.executedEvents.length > 0) {
      docData.executedEvents = message.executedEvents;
    }

    const docRef = await addDoc(colRef, docData);
    return docRef.id;
  } catch (err: any) {
    const isPerm =
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission-denied') ||
      err?.message?.includes('Missing or insufficient permissions');

    if (isPerm) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
    console.warn('Could not save chat message to Firestore (offline/transient):', err?.message || err);
    return undefined;
  }
}

export function subscribeToMessages(userId: string, callback: (msgs: ChatMessage[]) => void, onError?: (err: any) => void) {
  const path = `users/${userId}/chat_messages`;
  const colRef = collection(db, 'users', userId, 'chat_messages');
  const q = query(colRef, orderBy('createdAt', 'asc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ChatMessage[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) });
      });
      callback(items);
    },
    (error: any) => {
      const isPerm =
        error?.code === 'permission-denied' ||
        error?.message?.includes('permission-denied') ||
        error?.message?.includes('Missing or insufficient permissions');

      if (isPerm) {
        handleFirestoreError(error, OperationType.GET, path);
      }
      console.warn('Message subscription error (offline/transient):', error?.message || error);
      if (onError) onError(error);
    }
  );
}

export async function clearChatMessages(userId: string): Promise<void> {
  const path = `users/${userId}/chat_messages`;
  try {
    const colRef = collection(db, 'users', userId, 'chat_messages');
    const snap = await getDocs(colRef);
    const deletePromises = snap.docs.map((d) => {
      const docRef = doc(db, 'users', userId, 'chat_messages', d.id);
      return deleteDoc(docRef);
    });
    await Promise.all(deletePromises);
  } catch (err: any) {
    const isPerm =
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission-denied') ||
      err?.message?.includes('Missing or insufficient permissions');

    if (isPerm) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    console.warn('Could not clear chat messages from Firestore (offline/transient):', err?.message || err);
  }
}

export async function logMeetingAction(userId: string, log: Omit<MeetingAuditLog, 'id' | 'userId' | 'createdAt'>): Promise<string | undefined> {
  const path = `users/${userId}/meeting_logs`;
  try {
    const colRef = collection(db, 'users', userId, 'meeting_logs');
    const docData: Record<string, any> = {
      title: log.title,
      action: log.action,
      userId,
      createdAt: new Date().toISOString(),
    };
    if (log.eventId) docData.eventId = log.eventId;
    if (log.startDateTime) docData.startDateTime = log.startDateTime;
    if (log.endDateTime) docData.endDateTime = log.endDateTime;

    const docRef = await addDoc(colRef, docData);
    return docRef.id;
  } catch (err: any) {
    const isPerm =
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission-denied') ||
      err?.message?.includes('Missing or insufficient permissions');

    if (isPerm) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
    console.warn('Could not log meeting action in Firestore (offline/transient):', err?.message || err);
    return undefined;
  }
}

export async function getRecentMeetingLogs(userId: string): Promise<MeetingAuditLog[]> {
  const path = `users/${userId}/meeting_logs`;
  try {
    const colRef = collection(db, 'users', userId, 'meeting_logs');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    const logs: MeetingAuditLog[] = [];
    snap.forEach((d) => {
      logs.push({ id: d.id, ...(d.data() as Omit<MeetingAuditLog, 'id'>) });
    });
    return logs;
  } catch (err: any) {
    const isPerm =
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission-denied') ||
      err?.message?.includes('Missing or insufficient permissions');

    if (isPerm) {
      handleFirestoreError(err, OperationType.GET, path);
    }
    console.warn('Could not fetch meeting logs from Firestore (offline/transient):', err?.message || err);
    return [];
  }
}
