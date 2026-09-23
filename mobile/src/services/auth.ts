import { ApiError, apiRequest } from '@/services/api';
import { clearAuth, getAuth, saveAuth, type StoredUser } from '@/services/auth-storage';

export { ApiError } from '@/services/api';
export type UserProfile = Omit<StoredUser, 'token'>;
type UserResponse = { user: { id: number; nome: string; email: string } };
type LoginResponse = UserResponse & { token: string };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string) {
  const normalized = email.trim();
  if (!EMAIL_PATTERN.test(normalized)) throw new ApiError('validation', 'Digite um e-mail válido.');
  return normalized;
}

function profileFrom(response: UserResponse): UserProfile {
  const user = response?.user;
  if (
    !user ||
    !Number.isInteger(user.id) ||
    user.id <= 0 ||
    typeof user.nome !== 'string' ||
    typeof user.email !== 'string'
  ) {
    throw new ApiError('server', 'Dados de usuário inválidos recebidos do servidor.');
  }
  return { id: user.id, name: user.nome, email: user.email };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  confirmation: string;
}) {
  if (!input.name.trim() || !input.password)
    throw new ApiError('validation', 'Preencha todos os campos.');
  if (input.password !== input.confirmation)
    throw new ApiError('validation', 'As senhas não coincidem.');
  const response = await apiRequest<UserResponse>('/api/auth/register', {
    method: 'POST',
    authenticated: false,
    body: { nome: input.name.trim(), email: normalizeEmail(input.email), senha: input.password },
  });
  // Cadastro não cria uma sessão: o backend só fornece token no login.
  return profileFrom(response);
}

export async function loginUser(email: string, password: string): Promise<StoredUser> {
  if (!password) throw new ApiError('validation', 'Informe sua senha.');
  const response = await apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    authenticated: false,
    body: { email: normalizeEmail(email), senha: password },
  });
  if (typeof response?.token !== 'string' || !response.token || response.token === 'mock-token') {
    throw new ApiError('server', 'O servidor não retornou uma sessão válida.');
  }
  const session = { ...profileFrom(response), token: response.token };
  await saveAuth(session);
  return session;
}

export async function getProfile(): Promise<UserProfile> {
  return profileFrom(await apiRequest<UserResponse>('/api/auth/profile'));
}

export async function restoreSession(): Promise<StoredUser | null> {
  const stored = await getAuth();
  if (!stored) return null;
  try {
    const profile = await getProfile();
    // Não restaurar uma sessão se houve logout enquanto a requisição estava em andamento.
    return await saveAuth({ ...profile, token: stored.token }, stored.token);
  } catch (error) {
    if (error instanceof ApiError && [401, 404].includes(error.status ?? 0)) {
      await clearAuth(stored.token);
      return null;
    }
    throw error;
  }


}


export async function updateProfile(input: { name: string; email: string }): Promise<UserProfile> {
  const name = input.name.trim();
  if (!name) throw new ApiError('validation', 'Informe seu nome.');

  const response = await apiRequest<UserResponse>('/api/auth/profile', {
    method: 'PUT',
    body: { nome: name, email: normalizeEmail(input.email) },
  });
  const profile = profileFrom(response);

  // Atualiza a sessão salva no aparelho para o app inteiro enxergar os dados novos
  const stored = await getAuth();
  if (stored) await saveAuth({ ...profile, token: stored.token }, stored.token);

  return profile;
}


export function logoutUser(): Promise<void> {
  // O backend usa JWT sem endpoint de revogação; o logout remove a sessão deste dispositivo.
  return clearAuth();
}

export async function forgotPassword(email: string): Promise<void> {
  const response = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    authenticated: false,
    body: { email: normalizeEmail(email) },
  });
  if (typeof response?.message !== 'string') {
    throw new ApiError('server', 'Resposta inválida ao solicitar recuperação de senha.');
  }
}
