import { useQuery } from '@tanstack/react-query';

import { fetchActivitySummary, fetchGlobalSummary } from '@/api/reports';
import type { Period } from '@/api/types';

export function useActivitySummary(activityId: number | undefined, period: Period, currency?: string, date?: string) {
  return useQuery({
    queryKey: ['reports', 'activity', activityId, period, currency, date],
    queryFn: () => fetchActivitySummary(activityId as number, { period, currency, date }),
    enabled: activityId !== undefined,
  });
}

export function useGlobalSummary(period: Period, currency?: string, date?: string) {
  return useQuery({
    queryKey: ['reports', 'global', period, currency, date],
    queryFn: () => fetchGlobalSummary({ period, currency, date }),
  });
}
