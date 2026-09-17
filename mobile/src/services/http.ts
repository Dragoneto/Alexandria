import { API_TIMEOUT, API_URL } from '@/constants/env';
import { getAuth } from '@/services/auth-storage';

export type ApiErrorKind = 'validation' | 'auth' | 'network' | 'server' | 'config';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status: number;
  /** Mapa campo -> mensagem, como o GlobalExceptionHandler do Spring devolve. */
  fieldErrors?: Record<string, string>;

  constructor(
    kind: ApiErrorKind,
    message: string,
    status = 0,
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Corpo de erro do backend (ErrorResponse do Spring). */
type ErrorBody = {
  message?: string;
  errors?: Record<string, string> | null;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Rotas públicas (login, cadastro, forgot-password) não mandam token. */
  auth?: boolean;
  timeoutMs?: number;
};

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 400) return 'validation';
  if (status === 401 || status === 403) return 'auth';
  if (status === 409) return 'validation';

  return 'server';
}

function messageFrom(body: ErrorBody | null, status: number): string {
  if (body?.errors) {
    const first = Object.values(body.errors)[0];
    if (first) return first;
  }

  if (body?.message) return body.message;

  if (status === 401) return 'E-mail ou senha incorretos.';
  if (status === 403) return 'Sua sessão expirou. Entre novamente.';
  if (status === 404) return 'Não encontramos o que você pediu.';
  if (status >= 500) return 'O servidor teve um problema. Tente de novo em instantes.';

  return 'Não foi possível concluir a operação.';
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, timeoutMs = API_TIMEOUT } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };

  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const stored = await getAuth();
    if (stored?.token) headers.Authorization = `Bearer ${stored.token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('network', 'Não foi possível conectar ao servidor.');
  } finally {
    clearTimeout(timer);
  }

  const raw = response.status === 204 ? '' : await response.text();
  let parsed: unknown = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ApiError(
        'server',
        `Resposta inválida do servidor (HTTP ${response.status}).`,
        response.status,
      );
    }
  }

  if (!response.ok) {
    const errorBody = parsed as ErrorBody | null;

    throw new ApiError(
      kindFromStatus(response.status),
      messageFrom(errorBody, response.status),
      response.status,
      errorBody?.errors ?? undefined,
    );
  }

  return parsed as T;
}
