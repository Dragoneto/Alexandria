import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { clearAuth, getAuth, saveAuth, type StoredUser } from '@/services/auth-storage';
import { setUnauthorizedListener } from '@/services/http';

type AuthContextValue = {
  user: StoredUser | null;
  isLoading: boolean;
  signIn: (user: StoredUser) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getAuth()
      .then((stored) => {
        if (isMounted) setUser(stored);
      })
      .catch(() => {
        if (isMounted) setUser(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = useCallback(async (nextUser: StoredUser) => {
    await saveAuth(nextUser);
    setUser(nextUser);
  }, []);

  const signOut = useCallback(async () => {
    await clearAuth();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedListener(() => {
      void signOut();
    });

    return () => {
      setUnauthorizedListener(null);
    };
  }, [signOut]);

  const value = useMemo(
    () => ({ user, isLoading, signIn, signOut }),
    [user, isLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider.');
  }

  return context;
}
