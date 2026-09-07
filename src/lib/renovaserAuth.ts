import type { AppUser } from '../types';

export interface AppUserWithAuth extends AppUser {
  passwordHash?: string; // Stored password check
}

export const ADMIN_EMAILS = [
  'claudirisrael@gmail.com',
  'clecimarchioro@gmail.com',
  'mmgorete00@gmail.com',
];

export const INITIAL_ADMINS: AppUserWithAuth[] = [
  {
    id: 'admin-claudir',
    name: 'Claudir',
    email: 'claudirisrael@gmail.com',
    role: 'admin',
    createdAt: '2025-01-01T00:00:00.000Z',
    passwordHash: 'Rs12345678',
  },
  {
    id: 'admin-cleci',
    name: 'Cleci',
    email: 'clecimarchioro@gmail.com',
    role: 'admin',
    createdAt: '2025-01-01T00:00:00.000Z',
    passwordHash: 'Rs12345678',
  },
  {
    id: 'admin-gorete',
    name: 'Gorete',
    email: 'mmgorete00@gmail.com',
    role: 'admin',
    createdAt: '2025-01-01T00:00:00.000Z',
    passwordHash: 'RS12345678',
  },
];

export const INITIAL_PROFESSIONALS: AppUserWithAuth[] = [
  {
    id: 'prof-lucas',
    name: 'Dr. Lucas Ramos',
    email: 'lucas.psico@institutorenovaser.com.br',
    role: 'professional',
    specialty: 'Psicólogo',
    createdAt: '2025-01-10T00:00:00.000Z',
    passwordHash: 'Psico1234',
  },
  {
    id: 'prof-mariana',
    name: 'Dra. Mariana Silva',
    email: 'mariana.fisio@institutorenovaser.com.br',
    role: 'professional',
    specialty: 'Fisioterapeuta',
    createdAt: '2025-01-15T00:00:00.000Z',
    passwordHash: 'Fisio1234',
  },
];

const USERS_STORAGE_KEY = 'renovaser_registered_users_v3';
const ACTIVE_USER_KEY = 'renovaser_active_user_v3';

export function getRegisteredUsers(): AppUserWithAuth[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      const initialList = [...INITIAL_ADMINS, ...INITIAL_PROFESSIONALS];
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initialList));
      return initialList;
    }
    const parsed: AppUserWithAuth[] = JSON.parse(raw);
    let updated = false;
    for (const adm of INITIAL_ADMINS) {
      const exists = parsed.some((u) => u.email.toLowerCase() === adm.email.toLowerCase());
      if (!exists) {
        parsed.push(adm);
        updated = true;
      }
    }
    if (updated) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch (e) {
    console.warn('Erro ao carregar usuários:', e);
    return [...INITIAL_ADMINS, ...INITIAL_PROFESSIONALS];
  }
}

export function saveRegisteredUsers(users: AppUserWithAuth[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('Erro ao salvar usuários:', e);
  }
}

export function getActiveUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(ACTIVE_USER_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Erro ao carregar usuário ativo:', e);
  }
  return INITIAL_ADMINS[0]; // Claudir by default
}

export function setActiveUser(user: AppUser | null): void {
  try {
    if (user) {
      localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(ACTIVE_USER_KEY);
    }
  } catch (e) {
    console.warn('Erro ao persistir usuário ativo:', e);
  }
}

export function loginWithEmailPassword(
  emailInput: string,
  passwordInput: string
): { success: boolean; user?: AppUser; message: string; notRegistered?: boolean } {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  const allUsers = getRegisteredUsers();
  const found = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!found) {
    return {
      success: false,
      message: 'E-mail ou senha incorretos. Tente novamente.',
      notRegistered: true,
    };
  }

  // Exact password check
  if (found.passwordHash !== cleanPass) {
    return {
      success: false,
      message: 'E-mail ou senha incorretos. Tente novamente.',
    };
  }

  const roleLabel = found.role === 'admin' ? 'Administrador' : 'Profissional';
  const sanitizedUser: AppUser = {
    id: found.id,
    name: found.name,
    email: found.email,
    role: found.role,
    specialty: found.specialty,
    createdAt: found.createdAt,
  };

  setActiveUser(sanitizedUser);
  return {
    success: true,
    user: sanitizedUser,
    message: `Login realizado. Bem-vindo(a), ${found.name}. Acesso: ${roleLabel}.`,
  };
}

export function registerProfessional(
  name: string,
  email: string,
  password: string,
  specialty: string
): { success: boolean; user?: AppUser; message: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const cleanPass = password.trim();
  const cleanSpec = specialty.trim();

  if (!cleanName || !cleanEmail || !cleanPass || !cleanSpec) {
    return { success: false, message: 'Todos os campos são obrigatórios (nome, e-mail, senha e especialidade).' };
  }

  const allUsers = getRegisteredUsers();
  const exists = allUsers.some((u) => u.email.toLowerCase() === cleanEmail);
  if (exists) {
    return { success: false, message: 'Já existe um usuário cadastrado com este e-mail.' };
  }

  const newUser: AppUserWithAuth = {
    id: 'prof-' + Date.now(),
    name: cleanName,
    email: cleanEmail,
    role: 'professional',
    specialty: cleanSpec,
    createdAt: new Date().toISOString(),
    passwordHash: cleanPass,
  };

  allUsers.push(newUser);
  saveRegisteredUsers(allUsers);

  const sanitizedUser: AppUser = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    specialty: newUser.specialty,
    createdAt: newUser.createdAt,
  };

  setActiveUser(sanitizedUser);
  return {
    success: true,
    user: sanitizedUser,
    message: `Cadastro realizado com sucesso! Bem-vindo(a), ${cleanName} (${cleanSpec}).`,
  };
}

export function removeProfessional(
  targetEmail: string,
  requesterUser: AppUser
): { success: boolean; message: string } {
  if (requesterUser.role !== 'admin') {
    return { success: false, message: 'Apenas administradores podem remover profissionais.' };
  }

  const cleanTarget = targetEmail.trim().toLowerCase();
  if (ADMIN_EMAILS.includes(cleanTarget)) {
    return { success: false, message: 'Não é permitido remover um administrador do sistema.' };
  }

  const allUsers = getRegisteredUsers();
  const filtered = allUsers.filter((u) => u.email.toLowerCase() !== cleanTarget);

  if (filtered.length === allUsers.length) {
    return { success: false, message: 'Profissional não encontrado com o e-mail informado.' };
  }

  saveRegisteredUsers(filtered);
  return { success: true, message: `Profissional com e-mail ${targetEmail} removido com sucesso.` };
}
