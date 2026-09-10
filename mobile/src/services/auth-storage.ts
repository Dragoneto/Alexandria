import * as SecureStore from 'expo-secure-store';

const AUTH_KEY = 'alexandria_auth';

export type StoredUser = {
  token: string;
  id: number;
  name: string;
  email: string;
};

export async function saveAuth(user: StoredUser): Promise<void> {
  await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(user));
}

export async function getAuth(): Promise<StoredUser | null> {
  const raw = await SecureStore.getItemAsync(AUTH_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as StoredUser;
}

export async function clearAuth(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_KEY);
}

export async function updateAuth(patch: Partial<StoredUser>): Promise<StoredUser | null> {
  const current = await getAuth();
  if (!current) return null;

  const updated = { ...current, ...patch };
  await saveAuth(updated);
  return updated;
}