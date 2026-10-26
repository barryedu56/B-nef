import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';

/** Durée pendant laquelle les données téléchargées restent consultables
 * hors-ligne (listes, tableaux de bord, produits…). */
export const OFFLINE_CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 14; // 14 jours

// React Query sait si l'appareil est en ligne grâce à NetInfo : hors-ligne,
// il n'essaie même pas de recharger et garde les dernières données connues.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected && state.isInternetReachable !== false);
  })
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
      // Doit couvrir la durée de persistance, sinon les données sont
      // effacées de la mémoire avant d'avoir pu servir hors-ligne.
      gcTime: OFFLINE_CACHE_MAX_AGE,
    },
    mutations: {
      // Les envois gèrent eux-mêmes le hors-ligne (file d'attente, voir
      // offline/send.ts) : React Query ne doit pas les mettre en pause.
      networkMode: 'always',
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'benef-query-cache',
  throttleTime: 1000,
});
