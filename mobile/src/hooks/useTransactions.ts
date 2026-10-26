import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as financeApi from '@/api/finance';
import type { Transaction } from '@/api/types';
import * as offline from '@/offline/actions';
import { isQueued } from '@/offline/send';

export function useTransactions(activityId: number | undefined, limit?: number) {
  return useQuery({
    queryKey: ['transactions', activityId],
    queryFn: () => financeApi.listTransactions({ activity: activityId }),
    enabled: activityId !== undefined,
    select: (data) => (limit ? { ...data, results: data.results.slice(0, limit) } : data),
  });
}

export function usePartyTransactions(partyId: number | undefined) {
  return useQuery({
    queryKey: ['transactions', 'party', partyId],
    queryFn: () => financeApi.listTransactions({ party: partyId, ordering: '-occurred_on' }),
    enabled: partyId !== undefined,
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
    mutationFn: offline.createTransaction,
    onSuccess: (txn) => {
      invalidateAfterMoneyMove(queryClient, txn.activity, txn);
    },
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
    mutationFn: ({ txn, reason }: { txn: Transaction; reason?: string }) => offline.voidTransaction(txn, reason),
    onSuccess: (txn) => {
      queryClient.setQueryData(['transactions', 'detail', txn.id], txn);
      invalidateAfterMoneyMove(queryClient, txn.activity, txn);
    },
  });
}

export function useSettleTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ txn, input }: { txn: Transaction; input?: financeApi.SettleInput }) =>
      offline.settleTransaction(txn, input),
    onSuccess: (settlement) => {
      invalidateAfterMoneyMove(queryClient, settlement.activity, settlement);
    },
  });
}

// Les catégories par défaut sont globales (activity = null) : on ne filtre PAS
// par activité côté serveur, un filtre exact exclurait ces lignes NULL. Toutes
// les catégories du sens demandé sont donc proposées, quelle que soit l'activité.
export function useCategories(_activityId?: number, direction?: 'in' | 'out') {
  return useQuery({
    queryKey: ['categories', direction],
    queryFn: () => financeApi.listCategories({ direction }),
  });
}

export function usePaymentMethods() {
  return useQuery({ queryKey: ['payment-methods'], queryFn: financeApi.listPaymentMethods });
}

/** Recharge les données touchées par un mouvement d'argent. Pas si
 * l'opération est en file d'attente : on garderait sinon l'affichage
 * provisoire (stock, liste) qu'elle vient de poser — la synchronisation
 * recharge tout une fois l'opération enregistrée. */
export function invalidateAfterMoneyMove(
  queryClient: ReturnType<typeof useQueryClient>,
  activityId: number,
  result?: unknown
) {
  if (isQueued(result)) return;
  queryClient.invalidateQueries({ queryKey: ['transactions', activityId] });
  queryClient.invalidateQueries({ queryKey: ['transactions', 'party'] });
  queryClient.invalidateQueries({ queryKey: ['reports', 'activity', activityId] });
  queryClient.invalidateQueries({ queryKey: ['reports', 'global'] });
  queryClient.invalidateQueries({ queryKey: ['products'] });
  queryClient.invalidateQueries({ queryKey: ['parties'] });
  queryClient.invalidateQueries({ queryKey: ['budgets'] });
  queryClient.invalidateQueries({ queryKey: ['accounts'] });
}
