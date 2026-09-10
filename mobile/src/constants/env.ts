// O Expo substitui `process.env.EXPO_PUBLIC_*` em build time, então a chave
// precisa estar escrita por extenso: process.env[nome] não funciona.

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} não definida. Copie .env.example para .env e rode expo start -c.`);
  }

  return value.replace(/\/+$/, '');
}

function number(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const API_URL = required(process.env.EXPO_PUBLIC_API_URL, 'EXPO_PUBLIC_API_URL');

export const OPENLIBRARY_URL = required(
  process.env.EXPO_PUBLIC_OPENLIBRARY_URL,
  'EXPO_PUBLIC_OPENLIBRARY_URL',
);

export const API_TIMEOUT = number(process.env.EXPO_PUBLIC_API_TIMEOUT, 15000);