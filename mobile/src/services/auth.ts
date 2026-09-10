/**
 * Chamadas de autenticação ao backend.
 *
 * Por enquanto só o forgot-password (issue #11). Quando o cliente HTTP
 * compartilhado da issue #3 existir, as chamadas daqui passam a usá-lo.
 */

import { getApiUrl } from '@/constants/env';

const REQUEST_TIMEOUT_MS = 15000;

export type ForgotPasswordResponse = {
  message: string;
  resetToken: string | null;
  resetUrl: string | null;
};

export type ApiErrorKind = 'validation' | 'network' | 'server' | 'config';

export class ApiError extends Error {
  kind: ApiErrorKind;
  fieldErrors?: Record<string, string>;

  constructor(kind: ApiErrorKind, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.fieldErrors = fieldErrors;
  }
}

/** Corpo de erro do backend (ErrorResponse do Spring). */
type ErrorBody = {
  message?: string;
  errors?: Record<string, string> | null;
};

type RequestOptions = {
  timeoutMs?: number;
};

export async function requestPasswordReset(
  email: string,
  { timeoutMs = REQUEST_TIMEOUT_MS }: RequestOptions = {},
): Promise<ForgotPasswordResponse> {
  const baseUrl = getApiUrl();

  if (!baseUrl) {
    throw new ApiError('config', 'EXPO_PUBLIC_API_URL não configurada. Veja mobile/.env.example');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('network', 'Não foi possível conectar ao servidor.');
  } finally {
    clearTimeout(timer);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new ApiError('server', `Resposta inválida do servidor (HTTP ${response.status}).`);
  }

  if (response.status === 400) {
    const { message, errors } = (body ?? {}) as ErrorBody;
    const fieldErrors = errors ?? undefined;

    throw new ApiError('validation', fieldErrors?.email ?? message ?? 'Dados inválidos.', fieldErrors);
  }

  if (!response.ok) {
    const { message } = (body ?? {}) as ErrorBody;

    throw new ApiError('server', message ?? `Erro HTTP ${response.status}.`);
  }

  return body as ForgotPasswordResponse;
}
