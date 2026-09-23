import { request } from '@/services/http';

export { ApiError } from '@/services/http';
export type { ApiErrorKind } from '@/services/http';

/** Formato usado dentro do app, já achatado. */
export type AuthResponse = {
  token: string;
  email: string;
  name: string;
  userId: number;
};

export type UserProfile = {
  id: number;
  name: string;
  email: string;
};

export type ForgotPasswordResponse = {
  message: string;
  resetToken: string | null;
  resetUrl: string | null;
};

/** Formatos brutos que o backend Node/Express devolve hoje. */
type BackendAuthResponse = {
  message: string;
  token: string;
  user: { id: number; nome: string; email: string };
};

type BackendProfileResponse = {
  message?: string;
  user: { id: number; nome: string; email: string; criado_em?: string };
};

function toAuthResponse(raw: BackendAuthResponse): AuthResponse {
  return { token: raw.token, email: raw.user.email, name: raw.user.nome, userId: raw.user.id };
}

function toUserProfile(raw: BackendProfileResponse): UserProfile {
  return { id: raw.user.id, name: raw.user.nome, email: raw.user.email };
}

export async function login(email: string, password: string) {
  const raw = await request<BackendAuthResponse>('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { email: email.trim().toLowerCase(), senha: password },
  });
  return toAuthResponse(raw);
}

export async function register(name: string, email: string, password: string) {
  const raw = await request<BackendAuthResponse>('/api/auth/register', {
    method: 'POST',
    auth: false,
    body: { nome: name.trim(), email: email.trim().toLowerCase(), senha: password },
  });
  return toAuthResponse(raw);
}

export async function fetchProfile() {
  const raw = await request<BackendProfileResponse>('/api/auth/profile');
  return toUserProfile(raw);
}

export async function updateProfile(name: string, email: string) {
  const raw = await request<BackendProfileResponse>('/api/auth/profile', {
    method: 'PUT',
    body: { nome: name.trim(), email: email.trim().toLowerCase() },
  });
  return toUserProfile(raw);
}

export function requestPasswordReset(email: string) {
  return request<ForgotPasswordResponse>('/api/auth/forgot-password', {
    method: 'POST',
    auth: false,
    body: { email: email.trim().toLowerCase() },
  });
}