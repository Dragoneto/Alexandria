import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { logoutUser, restoreSession } from '@/services/auth';
import { subscribeAuth, type StoredUser } from '@/services/auth-storage';

type AuthState = {
  user: StoredUser | null;
  loading: boolean;
  error: string;
  retry: () => void;
  dismissSession: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => {
    let active = true;
    restoreSession()
      .then((session) => {
        if (active) setUser(session);
      })
      .catch(() => {
        if (active)
          setError('Não foi possível verificar sua sessão. Confira a conexão e tente novamente.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setLoading(true);
    setError('');
    setAttempt((value) => value + 1);
  }, []);
  const dismissSession = async () => {
    try {
      await logoutUser();
      setError('');
    } catch {
      setError('Não foi possível remover a sessão salva. Tente novamente.');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, retry, dismissSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa de AuthProvider.');
  return context;
}
