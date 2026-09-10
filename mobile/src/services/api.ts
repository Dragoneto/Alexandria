import { getAuth } from '@/services/auth-storage';

const MOCK_MODE = true;

export const API_BASE_URL = 'http://localhost:8080';

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string;
};

type MockProfile = {
  id: number;
  name: string;
  email: string;
};

async function mockRequest(path: string, options: ApiRequestOptions): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, 400));

  if (path === '/api/auth/profile' && options.method === 'PUT') {
    const body = options.body as Partial<MockProfile>;
    const current = await getAuth();

    return {
      id: current?.id ?? 1,
      name: body.name ?? current?.name ?? '',
      email: body.email ?? current?.email ?? '',
    };
  }

  if (path === '/api/auth/profile') {
    const current = await getAuth();

    return {
      id: current?.id ?? 1,
      name: current?.name ?? '',
      email: current?.email ?? '',
    };
  }

  throw new Error('Rota mock não implementada: ' + path);
}

export async function apiRequest(path: string, options: ApiRequestOptions = {}): Promise<any> {
  if (MOCK_MODE) {
    return mockRequest(path, options);
  }

  const { method = 'GET', body, token } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message ?? 'Não foi possível concluir a requisição.');
  }

  return data;
}