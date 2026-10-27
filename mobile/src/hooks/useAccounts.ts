import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as financeApi from '@/api/finance';
import * as offline from '@/offline/actions';
import { invalidateAfterMoneyMove } from './useTransactions';

/** Toutes les caisses avec leur solde, et le total. `activity` : la part de
 * cette activité seulement (vue « Mon argent » filtrée). */
export function useAccountsOverview(activity: number | null = null) {
  return useQuery({
    queryKey: ['accounts', 'overview', activity],
    queryFn: () => financeApi.fetchAccountsOverview(activity),
  });
}

export function useAccountMovements(accountId: number | undefined, activity: number | null = null) {
  return useQuery({
    queryKey: ['transactions', 'account', accountId, activity],
    queryFn: () =>
      financeApi.listTransactions({
        payment_method: accountId,
        cash_only: true,
        ordering: '-occurred_on',
        ...(activity ? { activity } : {}),
      }),
    enabled: accountId !== undefined,
  });
}

export function useCashCounts(accountId: number | undefined, activity: number | null = null) {
  return useQuery({
    queryKey: ['accounts', 'counts', accountId, activity],
    queryFn: () => financeApi.listCashCounts(accountId as number, activity),
    enabled: accountId !== undefined,
  });
}

export function useCountCash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, input }: { accountId: number; input: financeApi.CountCashInput }) =>
      financeApi.countCash(accountId, input),
    onSuccess: (count) => invalidateAfterMoneyMove(queryClient, count.activity),
  });
}

export function useTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: offline.createTransfer,
    onSuccess: (result, input) => {
      invalidateAfterMoneyMove(queryClient, input.from_activity, result);
      if (input.to_activity && input.to_activity !== input.from_activity) {
        invalidateAfterMoneyMove(queryClient, input.to_activity, result);
      }
    },
  });
}

/** Entrées et sorties d'argent de chaque caisse sur une période. */
export function useCashFlow(period: string, date: string, activity: number | null = null) {
  return useQuery({
    queryKey: ['accounts', 'flow', period, date, activity],
    queryFn: () => financeApi.fetchCashFlow({ period, date, activity }),
  });
}
