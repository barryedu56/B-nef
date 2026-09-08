import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import * as financeApi from '@/api/finance';

export function useTransactions(params: financeApi.TransactionListParams) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => financeApi.listTransactions(params),
  });
}

export function useTransaction(id: number | undefined) {
  return useQuery({
    queryKey: ['transactions', 'detail', id],
    queryFn: () => financeApi.fetchTransaction(id as number),
    enabled: id !== undefined,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: financeApi.createTransaction,
    onSuccess: (txn) => invalidateAfterMoneyMove(queryClient, txn.activity),
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: financeApi.TransactionSafeUpdate }) =>
      financeApi.updateTransaction(id, patch),
    onSuccess: (txn) => {
      queryClient.setQueryData(['transactions', 'detail', txn.id], txn);
      invalidateAfterMoneyMove(queryClient, txn.activity);
    },
  });
}

export function useVoidTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => financeApi.voidTransaction(id, reason),
    onSuccess: (txn) => {
      queryClient.setQueryData(['transactions', 'detail', txn.id], txn);
      invalidateAfterMoneyMove(queryClient, txn.activity);
    },
  });
}

export function useSettleTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input?: financeApi.SettleInput }) =>
      financeApi.settleTransaction(id, input),
    onSuccess: (settlement) => invalidateAfterMoneyMove(queryClient, settlement.activity),
  });
}

// Les catégories par défaut sont globales (activity = null) : on ne filtre PAS
// par activité côté serveur, un filtre exact exclurait ces lignes NULL. Toutes
// les catégories du sens demandé sont donc proposées, quelle que soit l'activité.
export function useCategories(direction?: 'in' | 'out') {
  return useQuery({
    queryKey: ['categories', direction],
    queryFn: () => financeApi.listCategories({ direction }),
  });
}

export function usePaymentMethods() {
  return useQuery({ queryKey: ['payment-methods'], queryFn: financeApi.listPaymentMethods });
}

export function invalidateAfterMoneyMove(queryClient: QueryClient, activityId: number) {
  queryClient.invalidateQueries({ queryKey: ['transactions'] });
  queryClient.invalidateQueries({ queryKey: ['reports', 'activity', activityId] });
  queryClient.invalidateQueries({ queryKey: ['reports', 'global'] });
  queryClient.invalidateQueries({ queryKey: ['products'] });
  queryClient.invalidateQueries({ queryKey: ['parties'] });
}
