/**
 * Autenticação contra o backend Spring Boot (AuthController).
 * Os nomes de campo seguem os DTOs do backend: name, email, password.
 */

import { request } from '@/services/http';

export { ApiError } from '@/services/http';
export type { ApiErrorKind } from '@/services/http';

/** AuthResponse do backend. */
export type AuthResponse = {
  token: string;
  email: string;
  name: string;
  userId: number;
};

/** UserProfileResponse do backend. */
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

export function login(email: string, password: string) {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { email: email.trim().toLowerCase(), password },
  });
}

export function register(name: string, email: string, password: string) {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    auth: false,
    body: { name: name.trim(), email: email.trim().toLowerCase(), password },
  });
}

export function fetchProfile() {
  return request<UserProfile>('/api/auth/profile');
}

export function updateProfile(name: string, email: string) {
  return request<AuthResponse>('/api/auth/profile', {
    method: 'PUT',
    body: { name: name.trim(), email: email.trim().toLowerCase() },
  });
}

export function requestPasswordReset(email: string) {
  return request<ForgotPasswordResponse>('/api/auth/forgot-password', {
    method: 'POST',
    auth: false,
    body: { email: email.trim().toLowerCase() },
  });
}
