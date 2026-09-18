import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTH_KEY = 'alexandria_auth';

// O SecureStore não existe no navegador. Na web caímos para o localStorage,
// que não é seguro, mas ali o alvo é só desenvolvimento e demonstração.
const isWeb = Platform.OS === 'web';

export type StoredUser = {
  token: string;
  id: number;
  name: string;
  email: string;
};

async function write(value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(AUTH_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(AUTH_KEY, value);
}

async function read(): Promise<string | null> {
  if (isWeb) {
    return globalThis.localStorage?.getItem(AUTH_KEY) ?? null;
  }

  return SecureStore.getItemAsync(AUTH_KEY);
}

async function erase(): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(AUTH_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(AUTH_KEY);
}

export async function saveAuth(user: StoredUser): Promise<void> {
  await write(JSON.stringify(user));
}

export async function getAuth(): Promise<StoredUser | null> {
  const raw = await read();

  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    await erase();
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  await erase();
}

export async function updateAuth(patch: Partial<StoredUser>): Promise<StoredUser | null> {
  const current = await getAuth();

  if (!current) return null;

  const updated = { ...current, ...patch };
  await saveAuth(updated);

  return updated;
}
