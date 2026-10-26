import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as financeApi from '@/api/finance';
import * as offline from '@/offline/actions';
import { invalidateAfterMoneyMove } from './useTransactions';

/** Toutes les caisses avec leur solde, et le total. */
export function useAccountsOverview() {
  return useQuery({ queryKey: ['accounts', 'overview'], queryFn: financeApi.fetchAccountsOverview });
}

export function useAccountMovements(accountId: number | undefined) {
  return useQuery({
    queryKey: ['transactions', 'account', accountId],
    queryFn: () => financeApi.listTransactions({ payment_method: accountId, cash_only: true, ordering: '-occurred_on' }),
    enabled: accountId !== undefined,
  });
}

export function useCashCounts(accountId: number | undefined) {
  return useQuery({
    queryKey: ['accounts', 'counts', accountId],
    queryFn: () => financeApi.listCashCounts(accountId as number),
    enabled: accountId !== undefined,
  });
}

export function useCountCash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, input }: { accountId: number; input: { counted: string; activity: number; note?: string } }) =>
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
export function useCashFlow(period: string, date: string) {
  return useQuery({
    queryKey: ['accounts', 'flow', period, date],
    queryFn: () => financeApi.fetchCashFlow({ period, date }),
  });
}
