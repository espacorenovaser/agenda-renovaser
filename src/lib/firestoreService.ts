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
  { id: 'admin1', name: 'Claudir Israel', email: 'claudirisrael@gmail.com', role: 'admin', password: 'Rs12345678' },
  { id: 'admin2', name: 'Maria Gorete', email: 'mmgorete00@gmail.com', role: 'admin', password: 'Rs12345678' },
  { id: 'admin3', name: 'Cleci Marchioro', email: 'clecimarchioro@gmail.com', role: 'admin', password: 'Rs12345678' },
  { id: 'admin4', name: 'Espaço RenovaSer', email: 'espacorenovaser@gmail.com', role: 'admin', password: 'renovaser123' },
  { id: 'terapeuta1', name: 'Dr. Lucas', email: 'lucas.psico@institutorenovaser.com.br', role: 'terapeuta', technique: 'Psicoterapia', password: 'renovaser123' },
  { id: 'terapeuta2', name: 'Adriana Israel', email: 'acky0608@gmail.com', role: 'terapeuta', technique: 'Tarô', password: 'renovaser123' }
];

export const DEFAULT_EVENTS: Evento[] = [
  {
    id: 'evt-1',
    title: 'Atendimento Clínico - Dr. Lucas',
    category: 'atendimento',
    time: '14:00 - 15:00',
    date: new Date().toISOString().split('T')[0],
    location: 'Sala 1 • Harmonia',
    type: 'presencial',
    roomId: 'sala_1',
    roomName: 'Sala 1 • Harmonia',
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

const LOCAL_EVENTS_KEY = 'renovaser_cached_events_v2';
const LOCAL_THERAPISTS_KEY = 'renovaser_cached_therapists_v2';

/**
 * Valida e sanitiza formatos de horário (ex: "14:00 - 15:00").
 * Repara automaticamente valores inválidos como "26:00 - 13:00" para horários reais legítimos.
 */
export function sanitizeEventTime(timeStr: string | undefined): string {
  if (!timeStr || typeof timeStr !== 'string') return '14:00 - 15:00';
  const parts = timeStr.split('-');
  const startPart = parts[0]?.trim() || '';
  const endPart = parts[1]?.trim() || '';

  const [sHStr, sMStr] = startPart.split(':');
  let sH = parseInt(sHStr, 10);
  let sM = parseInt(sMStr, 10) || 0;

  const [eHStr, eMStr] = endPart ? endPart.split(':') : ['', ''];
  let eH = parseInt(eHStr, 10);
  let eM = parseInt(eMStr, 10) || 0;

  // Se a hora inicial for inválida (ex: 26:00 como no caso do bug de dia/hora)
  if (isNaN(sH) || sH < 0 || sH >= 24) {
    if (!isNaN(eH) && eH >= 0 && eH < 24) {
      // Se a hora final era legítima (ex: 13:00), converte para o horário de início desejado!
      sH = eH;
      sM = eM;
      eH = sH + 1 < 24 ? sH + 1 : 23;
    } else {
      sH = 14;
      sM = 0;
      eH = 15;
      eM = 0;
    }
  }

  if (sM < 0 || sM >= 60) sM = 0;

  // Se a hora final for inválida ou menor/igual à inicial
  if (isNaN(eH) || eH < 0 || eH >= 24 || eH <= sH) {
    eH = sH + 1 < 24 ? sH + 1 : 23;
    eM = sM;
  }
  if (eM < 0 || eM >= 60) eM = 0;

  return `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')} - ${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
}

export function getCachedLocalEvents(): Evento[] {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((e) => ({
          ...e,
          time: sanitizeEventTime(e.time)
        }));
      }
    }
  } catch (e) {
    console.warn('Erro ao ler cache local de eventos:', e);
  }
  return DEFAULT_EVENTS;
}

export function setCachedLocalEvents(events: Evento[]): void {
  try {
    const cleaned = events.map((e) => ({
      ...e,
      time: sanitizeEventTime(e.time)
    }));
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(cleaned));
  } catch (e) {
    console.warn('Erro ao gravar cache local de eventos:', e);
  }
}

export function getCachedLocalTherapists(): TherapistUser[] {
  try {
    const raw = localStorage.getItem(LOCAL_THERAPISTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao ler cache local de terapeutas:', e);
  }
  return DEFAULT_THERAPISTS;
}

export function setCachedLocalTherapists(therapists: TherapistUser[]): void {
  try {
    localStorage.setItem(LOCAL_THERAPISTS_KEY, JSON.stringify(therapists));
  } catch (e) {
    console.warn('Erro ao gravar cache local de terapeutas:', e);
  }
}

/**
 * Escuta em tempo real os eventos cadastrados no Firestore
 */
export function subscribeToEvents(
  callback: (events: Evento[]) => void,
  onError?: (err: any) => void
) {
  const path = EVENTS_COLLECTION;
  const colRef = collection(db, EVENTS_COLLECTION);

  // Fornece imediatamente os eventos em cache para evitar telas vazias
  const localInitial = getCachedLocalEvents();
  if (localInitial.length > 0) {
    callback(localInitial);
  }

  let hasSeeded = false;

  return onSnapshot(
    colRef,
    async (snapshot) => {
      if (snapshot.empty && !hasSeeded) {
        hasSeeded = true;
        // Inicializar com dados padrão ou cache caso o banco esteja vazio
        try {
          const eventsToSeed = localInitial.length > 0 ? localInitial : DEFAULT_EVENTS;
          for (const ev of eventsToSeed) {
            await setDoc(doc(db, EVENTS_COLLECTION, ev.id), {
              ...ev,
              time: sanitizeEventTime(ev.time)
            });
          }
          callback(eventsToSeed);
          return;
        } catch (seedErr) {
          console.warn('Erro ao inicializar eventos padrão no Firestore:', seedErr);
        }
      }

      const items: Evento[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const rawTime = data.time || '14:00 - 15:00';
        const cleanTime = sanitizeEventTime(rawTime);

        // Se o horário estava com hora inválida (ex: 26:00), repara imediatamente no Firestore
        if (rawTime !== cleanTime) {
          setDoc(doc(db, EVENTS_COLLECTION, d.id), { time: cleanTime }, { merge: true }).catch(() => {});
        }

        items.push({
          id: d.id,
          title: data.title || '(Sem título)',
          category: data.category || 'atendimento',
          time: cleanTime,
          date: data.date || new Date().toISOString().split('T')[0],
          location: data.location || 'Sala do Instituto RenovaSer',
          type: data.type || 'presencial',
          therapistId: data.therapistId || 'admin1',
          roomId: data.roomId,
          roomName: data.roomName,
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
          googleEventId: data.googleEventId,
          googleHtmlLink: data.googleHtmlLink,
          syncedWithGoogle: data.syncedWithGoogle,
        });
      });

      // Ordenar por data e horário
      items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      const finalEvents = items.length > 0 ? items : localInitial;
      setCachedLocalEvents(finalEvents);
      callback(finalEvents);
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
      // Fallback seguro em caso de indisponibilidade
      const cached = getCachedLocalEvents();
      callback(cached);
      if (onError) onError(error);
    }
  );
}

/**
 * Salva ou atualiza um evento no Firestore e no cache local
 */
export async function saveEvent(event: Omit<Evento, 'id'> & { id?: string }): Promise<string> {
  const path = EVENTS_COLLECTION;
  const eventId = event.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const eventDoc = doc(db, EVENTS_COLLECTION, eventId);
  const cleanTime = sanitizeEventTime(event.time);
  const dataToSave: Evento = {
    ...event,
    id: eventId,
    time: cleanTime,
    createdAt: event.createdAt || new Date().toISOString(),
  };

  // Atualizar cache local imediatamente
  try {
    const cached = getCachedLocalEvents();
    const idx = cached.findIndex((e) => e.id === eventId);
    let updated: Evento[];
    if (idx >= 0) {
      updated = [...cached];
      updated[idx] = dataToSave;
    } else {
      updated = [...cached, dataToSave];
    }
    setCachedLocalEvents(updated);
  } catch (cacheErr) {
    console.warn('Erro ao atualizar cache local:', cacheErr);
  }

  try {
    const writePromise = setDoc(eventDoc, dataToSave, { merge: true });
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 4000));
    await Promise.race([writePromise, timeoutPromise]);
    return eventId;
  } catch (err: any) {
    const isPerm =
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission-denied') ||
      err?.message?.includes('Missing or insufficient permissions');

    if (isPerm) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.error('Erro ao salvar evento no Firestore (mantido localmente):', err);
    return eventId;
  }
}

/**
 * Exclui um evento do Firestore e do cache local
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const path = `${EVENTS_COLLECTION}/${eventId}`;

  // Atualizar cache local imediatamente
  try {
    const cached = getCachedLocalEvents();
    const filtered = cached.filter((e) => e.id !== eventId);
    setCachedLocalEvents(filtered);
  } catch (cacheErr) {
    console.warn('Erro ao remover do cache local:', cacheErr);
  }

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

  // Fornece imediatamente os terapeutas em cache
  const localInitial = getCachedLocalTherapists();
  if (localInitial.length > 0) {
    callback(localInitial);
  }

  let hasSeeded = false;

  return onSnapshot(
    colRef,
    async (snapshot) => {
      if (snapshot.empty && !hasSeeded) {
        hasSeeded = true;
        // Inicializar com a equipe padrão caso não haja registros
        try {
          const toSeed = localInitial.length > 0 ? localInitial : DEFAULT_THERAPISTS;
          for (const t of toSeed) {
            await setDoc(doc(db, USERS_COLLECTION, t.id), {
              ...t,
              createdAt: new Date().toISOString(),
            });
          }
          callback(toSeed);
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
            technique: data.technique || '',
            password: data.password || 'renovaser123',
            createdAt: data.createdAt,
          });
        }
      });

      const finalTherapists = items.length > 0 ? items : localInitial;
      setCachedLocalTherapists(finalTherapists);
      callback(finalTherapists);
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
      const cached = getCachedLocalTherapists();
      callback(cached);
      if (onError) onError(error);
    }
  );
}

/**
 * Salva ou atualiza um terapeuta/usuário no Firestore
 */
export async function saveTherapist(therapist: Omit<TherapistUser, 'id'> & { id?: string }): Promise<string> {
  const path = USERS_COLLECTION;
  const userId = therapist.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const userDoc = doc(db, USERS_COLLECTION, userId);
  const dataToSave: TherapistUser = {
    id: userId,
    name: therapist.name,
    email: therapist.email,
    role: therapist.role || 'terapeuta',
    technique: therapist.technique || '',
    password: therapist.password || 'renovaser123',
    createdAt: therapist.createdAt || new Date().toISOString(),
  };

  // Atualiza cache local de terapeutas
  try {
    const cached = getCachedLocalTherapists();
    const idx = cached.findIndex((t) => t.id === userId || t.email.toLowerCase() === therapist.email.toLowerCase());
    let updated: TherapistUser[];
    if (idx >= 0) {
      updated = [...cached];
      updated[idx] = dataToSave;
    } else {
      updated = [...cached, dataToSave];
    }
    setCachedLocalTherapists(updated);
  } catch (cErr) {
    console.warn('Erro ao atualizar cache de terapeutas:', cErr);
  }

  try {
    const writePromise = setDoc(userDoc, dataToSave, { merge: true });
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 4000));
    await Promise.race([writePromise, timeoutPromise]);
    return userId;
  } catch (err: any) {
    const isPerm =
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission-denied') ||
      err?.message?.includes('Missing or insufficient permissions');

    if (isPerm) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.error('Erro ao salvar terapeuta no Firestore:', err);
    return userId;
  }
}

/**
 * Atualiza a senha de um terapeuta/usuário no Firestore
 */
export async function updateTherapistPassword(userId: string, newPassword: string): Promise<void> {
  const path = USERS_COLLECTION;
  const userDoc = doc(db, USERS_COLLECTION, userId);
  try {
    const writePromise = setDoc(userDoc, { password: newPassword }, { merge: true });
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 4000));
    await Promise.race([writePromise, timeoutPromise]);
  } catch (err: any) {
    const isPerm =
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission-denied') ||
      err?.message?.includes('Missing or insufficient permissions');
    if (isPerm) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.error('Erro ao atualizar senha no Firestore:', err);
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
