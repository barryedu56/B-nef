import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as authApi from '@/api/auth';
import { ApiError, clearTokens, getTokens, isNetworkError } from '@/api/client';
import type { Me } from '@/api/types';
import { claimOutbox, clearOutbox } from '@/offline/outbox';
import { warmOfflineCache } from '@/offline/prefetch';
import { persister } from '@/offline/queryClient';

// Dernier profil connu : permet d'ouvrir l'app sans réseau.
const ME_KEY = 'benef-me';

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
      await claimOutbox(me.id);
      await AsyncStorage.setItem(ME_KEY, JSON.stringify(me));
      setUser(me);
      setStatus('signedIn');
      void warmOfflineCache(true);
    } catch (error) {
      // Seule une session refusée (401/403) déconnecte. Pas de réseau, ou
      // serveur en panne / en redémarrage (500, 502…) : la session reste
      // valable, on travaille hors-ligne avec le dernier profil connu.
      const sessionRejected = error instanceof ApiError && (error.status === 401 || error.status === 403);
      if (isNetworkError(error) || !sessionRejected) {
        const cached = await AsyncStorage.getItem(ME_KEY);
        if (cached) {
          setUser(JSON.parse(cached) as Me);
          setStatus('signedIn');
          return;
        }
      }
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
    // Rien de ce compte ne doit rester sur le téléphone.
    await clearOutbox();
    await AsyncStorage.removeItem(ME_KEY);
    queryClient.clear();
    await persister.removeClient();
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
