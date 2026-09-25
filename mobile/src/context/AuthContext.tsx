import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as authApi from '@/api/auth';
import { clearTokens, getTokens } from '@/api/client';
import type { Me } from '@/api/types';

type Status = 'loading' | 'signedIn' | 'signedOut';

interface AuthContextValue {
  status: Status;
  user: Me | null;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (input: authApi.RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<Me | null>(null);
  const queryClient = useQueryClient();

  const loadUser = useCallback(async () => {
    try {
      const me = await authApi.fetchMe();
      setUser(me);
      setStatus('signedIn');
    } catch {
      await clearTokens();
      setUser(null);
      setStatus('signedOut');
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { access } = await getTokens();
      if (!access) {
        setStatus('signedOut');
        return;
      }
      await loadUser();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (username: string, password: string) => {
      await authApi.login(username, password);
      await loadUser();
    },
    [loadUser]
  );

  const signUp = useCallback(
    async (input: authApi.RegisterInput) => {
      await authApi.register(input);
      await authApi.login(input.username, input.password);
      await loadUser();
    },
    [loadUser]
  );

  const signOut = useCallback(async () => {
    await authApi.logout();
    queryClient.clear();
    setUser(null);
    setStatus('signedOut');
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, signUp, signOut, refreshUser: loadUser }),
    [status, user, signIn, signUp, signOut, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>.');
  return ctx;
}
