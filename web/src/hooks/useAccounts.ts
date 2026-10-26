import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as financeApi from '@/api/finance';
import { invalidateAfterMoneyMove } from './useTransactions';

/** Toutes les caisses avec leur solde, et le total. */
export function useAccountsOverview() {
  return useQuery({ queryKey: ['accounts', 'overview'], queryFn: financeApi.fetchAccountsOverview });
}

/** Les vrais mouvements d'argent d'une caisse (pas les ventes à crédit). */
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
    mutationFn: financeApi.createTransfer,
    onSuccess: (_result, input) => {
      invalidateAfterMoneyMove(queryClient, input.from_activity);
      if (input.to_activity) invalidateAfterMoneyMove(queryClient, input.to_activity);
    },
  });
}
