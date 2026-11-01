import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchActivitySummary, fetchGlobalSummary } from '@/api/reports';
import type { Period } from '@/api/types';
import { latestCached } from '@/offline/cacheLookup';

// Hors connexion, un résumé calculé un autre jour (même période, même
// devise) s'affiche plutôt qu'une erreur.
export function useActivitySummary(activityId: number | undefined, period: Period, currency?: string, date?: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['reports', 'activity', activityId, period, currency, date],
    queryFn: () => fetchActivitySummary(activityId as number, { period, currency, date }),
    enabled: activityId !== undefined,
    placeholderData: () => latestCached(queryClient, ['reports', 'activity', activityId, period, currency]),
  });
}

export function useGlobalSummary(period: Period, currency?: string, date?: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['reports', 'global', period, currency, date],
    queryFn: () => fetchGlobalSummary({ period, currency, date }),
    placeholderData: () => latestCached(queryClient, ['reports', 'global', period, currency]),
  });
}
