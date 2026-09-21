import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type { ChatMessage, MeetingAuditLog, UserProfile, Evento, TherapistUser } from '../types';

// Validate connection to Firestore on initialization
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration: the client is offline.');
    }
  }
}
// Run connection check non-blocking
testConnection().catch(() => {});

export const DEFAULT_THERAPISTS: TherapistUser[] = [
  { id: 'admin1', name: 'Claudir Israel (Admin)', email: 'claudirisrael@gmail.com', role: 'admin' },
  { id: 'admin2', name: 'Maria Gorete (Admin)', email: 'mmgorete00@gmail.com', role: 'admin' },
  { id: 'admin3', name: 'Cleci Marchioro (Admin)', email: 'clecimarchioro@gmail.com', role: 'admin' },
  { id: 'terapeuta1', name: 'Dr. Lucas (Terapeuta)', email: 'lucas.psico@institutorenovaser.com.br', role: 'terapeuta', technique: 'Psicoterapia' }
];

export const DEFAULT_EVENTS: Evento[] = [
  {
    id: 'evt-1',
    title: 'Atendimento Clínico - Dr. Lucas',
    category: 'atendimento',
    time: '14:00 - 15:00',
    date: new Date().toISOString().split('T')[0],
    location: 'Sala do Instituto RenovaSer',
    type: 'presencial',
    therapistId: 'terapeuta1',
    clientEmail: 'cliente@exemplo.com',
    clientWhatsApp: '(11) 98765-4321',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    createdAt: new Date().toISOString()
  },
  {
    id: 'evt-2',
    title: 'Reunião com Equipe de Terapeutas',
    category: 'reuniao',
    time: '19:30 - 20:30',
    date: new Date().toISOString().split('T')[0],
    location: 'Online - Google Meet',
    type: 'online',
    therapistId: 'admin1',
    clientEmail: '',
    clientWhatsApp: '',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    createdAt: new Date().toISOString()
  }
];

const EVENTS_COLLECTION = 'events';
const USERS_COLLECTION = 'users';

/**
 * Escuta em tempo real os eventos cadastrados no Firestore
 */
export function subscribeToEvents(
  callback: (events: Evento[]) => void,
  onError?: (err: any) => void
) {
  const path = EVENTS_COLLECTION;
  const colRef = collection(db, EVENTS_COLLECTION);

  let hasSeeded = false;

  return onSnapshot(
    colRef,
    async (snapshot) => {
      if (snapshot.empty && !hasSeeded) {
        hasSeeded = true;
        // Inicializar com dados padrão caso o banco esteja vazio
        try {
          for (const ev of DEFAULT_EVENTS) {
            await setDoc(doc(db, EVENTS_COLLECTION, ev.id), ev);
          }
          callback(DEFAULT_EVENTS);
          return;
        } catch (seedErr) {
          console.warn('Erro ao inicializar eventos padrão no Firestore:', seedErr);
        }
      }

      const items: Evento[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          title: data.title || '(Sem título)',
          category: data.category || 'atendimento',
          time: data.time || '14:00 - 15:00',
          date: data.date || new Date().toISOString().split('T')[0],
          location: data.location || 'Sala do Instituto RenovaSer',
          type: data.type || 'presencial',
          therapistId: data.therapistId || 'admin1',
          clientEmail: data.clientEmail || '',
          clientWhatsApp: data.clientWhatsApp || '',
          badgeColor:
            data.badgeColor ||
            (data.category === 'atendimento'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : data.category === 'reuniao'
              ? 'bg-blue-100 text-blue-800 border-blue-200'
              : 'bg-purple-100 text-purple-800 border-purple-200'),
          createdAt: data.createdAt,
        });
      });

      // Ordenar por data e horário
      items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      callback(items.length > 0 ? items : DEFAULT_EVENTS);
    },
    (error: any) => {
      const isPerm =
        error?.code === 'permission-denied' ||
        error?.message?.includes('permission-denied') ||
        error?.message?.includes('Missing or insufficient permissions');

      if (isPerm) {
        handleFirestoreError(error, OperationType.GET, path);
      }
      console.warn('Events subscription error (offline/transient):', error?.message || error);
      if (onError) onError(error);
    }
  );
}

/**
 * Salva ou atualiza um evento no Firestore
 */
export async function saveEvent(event: Omit<Evento, 'id'> & { id?: string }): Promise<string> {
  const path = EVENTS_COLLECTION;
  try {
    const eventId = event.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const eventDoc = doc(db, EVENTS_COLLECTION, eventId);
    const dataToSave = {
      ...event,
      id: eventId,
      createdAt: event.createdAt || new Date().toISOString(),
    };
    await setDoc(eventDoc, dataToSave, { merge: true });
    return eventId;
  } catch (err: any) {
    const isPerm =
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission-denied') ||
      err?.message?.includes('Missing or insufficient permissions');

    if (isPerm) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.error('Erro ao salvar evento no Firestore:', err);
    throw err;
  }
}

/**
 * Exclui um evento do Firestore
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const path = `${EVENTS_COLLECTION}/${eventId}`;
  try {
    const eventDoc = doc(db, EVENTS_COLLECTION, eventId);
    await deleteDoc(eventDoc);
  } catch (err: any) {
    const isPerm =
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission-denied') ||
      err?.message?.includes('Missing or insufficient permissions');

    if (isPerm) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    console.error('Erro ao excluir evento do Firestore:', err);
    throw err;
  }
}

/**
 * Escuta em tempo real os terapeutas e utilizadores cadastrados no Firestore
 */
export function subscribeToTherapists(
  callback: (therapists: TherapistUser[]) => void,
  onError?: (err: any) => void
) {
  const path = USERS_COLLECTION;
  const colRef = collection(db, USERS_COLLECTION);

  let hasSeeded = false;

  return onSnapshot(
    colRef,
    async (snapshot) => {
      if (snapshot.empty && !hasSeeded) {
        hasSeeded = true;
        // Inicializar com a equipe padrão caso não haja registros
        try {
          for (const t of DEFAULT_THERAPISTS) {
            await setDoc(doc(db, USERS_COLLECTION, t.id), {
              ...t,
              createdAt: new Date().toISOString(),
            });
          }
          callback(DEFAULT_THERAPISTS);
          return;
        } catch (seedErr) {
          console.warn('Erro ao inicializar equipe padrão no Firestore:', seedErr);
        }
      }

      const items: TherapistUser[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.name && data.email) {
          items.push({
            id: d.id,
            name: data.name,
            email: data.email,
            role: data.role === 'admin' ? 'admin' : 'terapeuta',
            createdAt: data.createdAt,
          });
        }
      });

      callback(items.length > 0 ? items : DEFAULT_THERAPISTS);
    },
    (error: any) => {
      const isPerm =
        error?.code === 'permission-denied' ||
        error?.message?.includes('permission-denied') ||
        error?.message?.includes('Missing or insufficient permissions');

      if (isPerm) {
        handleFirestoreError(error, OperationType.GET, path);
      }
      console.warn('Therapists subscription error (offline/transient):', error?.message || error);
      if (onError) onError(error);
    }
  );
}

/**
 * Salva ou atualiza um terapeuta/usuário no Firestore
 */
export async function saveTherapist(therapist: Omit<TherapistUser, 'id'> & { id?: string }): Promise<string> {
  const path = USERS_COLLECTION;
  try {
    const userId = therapist.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const userDoc = doc(db, USERS_COLLECTION, userId);
    const dataToSave = {
      ...therapist,
      id: userId,
      createdAt: therapist.createdAt || new Date().toISOString(),
    };
    await setDoc(userDoc, dataToSave, { merge: true });
    return userId;
  } catch (err: any) {
    const isPerm =
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission-denied') ||
      err?.message?.includes('Missing or insufficient permissions');

    if (isPerm) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.error('Erro ao salvar terapeuta/usuário no Firestore:', err);
    throw err;
  }
}

/**
 * Exclui um terapeuta/usuário do Firestore
 */
export async function deleteTherapist(therapistId: string): Promise<void> {
  const path = `${USERS_COLLECTION}/${therapistId}`;
  try {
    const userDoc = doc(db, USERS_COLLECTION, therapistId);
    await deleteDoc(userDoc);
  } catch (err: any) {
    const isPerm =
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission-denied') ||
      err?.message?.includes('Missing or insufficient permissions');

    if (isPerm) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    console.error('Erro ao excluir utilizador do Firestore:', err);
    throw err;
  }
}

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
