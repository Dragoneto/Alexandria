import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTH_KEY = 'alexandria_auth';
export type StoredUser = { token: string; id: number; name: string; email: string };
type Listener = (user: StoredUser | null) => void;
const listeners = new Set<Listener>();
let pending: Promise<unknown> = Promise.resolve();

// Serializa leituras e gravações para logout e restauração não se atropelarem.
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const next = pending.then(operation, operation);
  pending = next.catch(() => {});
  return next;
}

export function subscribeAuth(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(user: StoredUser | null) {
  listeners.forEach((listener) => listener(user));
}

export function isStoredUser(value: unknown): value is StoredUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Partial<StoredUser>;
  return (
    typeof user.token === 'string' &&
    user.token.length > 0 &&
    user.token !== 'mock-token' &&
    Number.isInteger(user.id) &&
    Number(user.id) > 0 &&
    typeof user.name === 'string' &&
    typeof user.email === 'string'
  );
}

async function removeStored() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(AUTH_KEY);
  } else {
    await SecureStore.deleteItemAsync(AUTH_KEY);
  }
}

async function readStored(): Promise<StoredUser | null> {
  const raw =
    Platform.OS === 'web'
      ? typeof window === 'undefined'
        ? null
        : window.sessionStorage.getItem(AUTH_KEY)
      : await SecureStore.getItemAsync(AUTH_KEY);
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    value = null;
  }
  if (isStoredUser(value)) return value;
  await removeStored();
  publish(null);
  return null;
}

export function getAuth(): Promise<StoredUser | null> {
  return serial(readStored);
}

export function saveAuth(user: StoredUser, expectedToken?: string): Promise<StoredUser | null> {
  return serial(async () => {
    if (!isStoredUser(user)) throw new Error('Sessão inválida recebida do servidor.');
    if (expectedToken && (await readStored())?.token !== expectedToken) return null;
    const raw = JSON.stringify(user);
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') throw new Error('Sessão indisponível neste ambiente.');
      window.sessionStorage.setItem(AUTH_KEY, raw);
    } else {
      await SecureStore.setItemAsync(AUTH_KEY, raw);
    }
    publish(user);
    return user;
  });
}

export function clearAuth(expectedToken?: string): Promise<void> {
  return serial(async () => {
    if (expectedToken && (await readStored())?.token !== expectedToken) return;
    await removeStored();
    publish(null);
  });
}
