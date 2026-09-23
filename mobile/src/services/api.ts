import { getApiConfig } from '@/constants/env';
import { clearAuth, getAuth } from '@/services/auth-storage';

export type ApiErrorKind = 'validation' | 'network' | 'server' | 'config' | 'auth' | 'timeout';
export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    message: string,
    public status?: number,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  authenticated?: boolean;
  timeoutMs?: number;
};

function errorBody(value: unknown) {
  if (!value || typeof value !== 'object') return {};
  const body = value as Record<string, unknown>;
  const message =
    typeof body.error === 'string'
      ? body.error
      : typeof body.message === 'string'
        ? body.message
        : undefined;
  const fields =
    body.errors && typeof body.errors === 'object'
      ? Object.fromEntries(
          Object.entries(body.errors).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : undefined;
  return { message, fields };
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let config: ReturnType<typeof getApiConfig>;
  try {
    config = getApiConfig();
  } catch (error) {
    throw new ApiError('config', error instanceof Error ? error.message : 'Configuração inválida.');
  }
  if (!path.startsWith('/') || path.startsWith('//'))
    throw new ApiError('config', 'Caminho de API inválido.');
  const { method = 'GET', body, authenticated = true } = options;
  const session = authenticated ? await getAuth() : null;
  if (authenticated && !session)
    throw new ApiError('auth', 'Entre na sua conta para continuar.', 401);
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 401 && session) await clearAuth(session.token);
    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      if (response.ok)
        throw new ApiError('server', 'Resposta inválida do servidor.', response.status);
    }
    if (!response.ok) {
      const { message, fields } = errorBody(data);
      const kind =
        response.status === 401
          ? 'auth'
          : [400, 409, 422].includes(response.status)
            ? 'validation'
            : 'server';
      throw new ApiError(
        kind,
        message ??
          (kind === 'auth'
            ? 'Sua sessão expirou. Entre novamente.'
            : `Não foi possível concluir a solicitação (HTTP ${response.status}).`),
        response.status,
        fields,
      );
    }
    if (!text && response.status !== 204)
      throw new ApiError('server', 'Resposta vazia do servidor.', response.status);
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted)
      throw new ApiError('timeout', 'O servidor demorou para responder. Tente novamente.');
    throw new ApiError('network', 'Não foi possível conectar ao servidor. Verifique sua conexão.');
  } finally {
    clearTimeout(timer);
  }
}
