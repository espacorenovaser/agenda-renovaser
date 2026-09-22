import type { TherapistUser } from '../types';
import { saveTherapist, updateTherapistPassword, DEFAULT_THERAPISTS } from './firestoreService';

const SESSION_USER_KEY = 'renovaser_active_user_v4';

/**
 * Retorna o usuário logado salvo na sessão do navegador
 */
export function getCurrentSessionUser(): TherapistUser | null {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email && parsed.role) {
        return parsed as TherapistUser;
      }
    }
  } catch (err) {
    console.warn('Erro ao recuperar usuário da sessão:', err);
  }
  return null;
}

/**
 * Define o usuário logado na sessão do navegador
 */
export function setCurrentSessionUser(user: TherapistUser | null): void {
  try {
    if (user) {
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_USER_KEY);
    }
  } catch (err) {
    console.warn('Erro ao salvar usuário na sessão:', err);
  }
}

/**
 * Realiza o logout do usuário
 */
export function logoutSession(): void {
  localStorage.removeItem(SESSION_USER_KEY);
}

/**
 * Autentica o usuário pelo e-mail e senha
 */
export function authenticateWithPassword(
  emailInput: string,
  passwordInput: string,
  availableTherapists: TherapistUser[]
): { success: boolean; user?: TherapistUser; message: string } {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanPassword = passwordInput.trim();

  if (!cleanEmail || !cleanPassword) {
    return { success: false, message: 'Por favor, informe seu e-mail e sua senha de acesso.' };
  }

  // Lista combinada de terapeutas cadastrados no Firestore + lista padrão
  const allKnown = [...availableTherapists];
  for (const def of DEFAULT_THERAPISTS) {
    if (!allKnown.some((u) => u.email.toLowerCase() === def.email.toLowerCase())) {
      allKnown.push(def);
    }
  }

  // Busca pelo e-mail
  const match = allKnown.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!match) {
    return {
      success: false,
      message: 'Usuário não encontrado com este e-mail. Se for seu primeiro acesso, realize o cadastro.',
    };
  }

  // Validação de senha:
  // 1. Senha gravada no documento
  // 2. Senhas padrão iniciais aceitas: 'renovaser123', 'Rs12345678' ou senha específica do usuário
  const storedPassword = match.password || 'renovaser123';
  const isCorrect =
    storedPassword === cleanPassword ||
    cleanPassword === 'renovaser123' ||
    (match.role === 'admin' && (cleanPassword === 'Rs12345678' || cleanPassword === 'RS12345678'));

  if (!isCorrect) {
    return {
      success: false,
      message: 'Senha incorreta. Verifique os caracteres ou solicite redefinição.',
    };
  }

  // Sessão autenticada
  const authenticatedUser: TherapistUser = {
    ...match,
    password: cleanPassword, // preserva a senha confirmada
  };

  setCurrentSessionUser(authenticatedUser);

  return {
    success: true,
    user: authenticatedUser,
    message: `Acesso autorizado! Bem-vindo(a), ${match.name}.`,
  };
}

/**
 * Registra um novo usuário (terapeuta ou admin) e cria a sessão
 */
export async function registerNewUser(
  data: {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'terapeuta';
    technique?: string;
  },
  existingTherapists: TherapistUser[]
): Promise<TherapistUser> {
  const cleanName = data.name.trim();
  const cleanEmail = data.email.trim().toLowerCase();
  const cleanPassword = data.password.trim();
  const cleanTechnique = data.technique?.trim() || '';

  if (!cleanName || !cleanEmail || !cleanPassword) {
    throw new Error('Nome, e-mail e senha são obrigatórios.');
  }

  // Verifica duplicidade de e-mail
  const exists = existingTherapists.some((t) => t.email.toLowerCase() === cleanEmail);
  if (exists) {
    throw new Error('Já existe um usuário cadastrado com este e-mail.');
  }

  const newId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newUser: TherapistUser = {
    id: newId,
    name: cleanName,
    email: cleanEmail,
    role: data.role,
    technique: cleanTechnique || undefined,
    password: cleanPassword,
    createdAt: new Date().toISOString(),
  };

  await saveTherapist(newUser);
  setCurrentSessionUser(newUser);
  return newUser;
}

/**
 * Atualiza a senha do usuário
 */
export async function changeUserPassword(
  userId: string,
  newPassword: string,
  currentUser: TherapistUser
): Promise<TherapistUser> {
  await updateTherapistPassword(userId, newPassword);
  const updatedUser: TherapistUser = {
    ...currentUser,
    password: newPassword,
  };
  setCurrentSessionUser(updatedUser);
  return updatedUser;
}
