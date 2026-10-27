import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as recurringApi from '@/api/recurring';
import * as offline from '@/offline/actions';
import { isQueued } from '@/offline/send';
import { invalidateAfterMoneyMove } from './useTransactions';

export function useRecurring() {
  return useQuery({ queryKey: ['recurring', 'list'], queryFn: recurringApi.listRecurring });
}

/** Échéances arrivées, à confirmer (rechargées toutes les 5 minutes). */
export function useDueOperations() {
  return useQuery({ queryKey: ['recurring', 'due'], queryFn: recurringApi.listDue, refetchInterval: 5 * 60 * 1000 });
}

function useInvalidateRecurring() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['recurring'] });
}

export function useSaveRecurring() {
  const invalidate = useInvalidateRecurring();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: recurringApi.RecurringInput }) =>
      id ? recurringApi.updateRecurring(id, input) : recurringApi.createRecurring(input),
    onSuccess: invalidate,
  });
}

export function useDeleteRecurring() {
  const invalidate = useInvalidateRecurring();
  return useMutation({ mutationFn: recurringApi.deleteRecurring, onSuccess: invalidate });
}

/** Confirmer / passer une échéance (fonctionne aussi hors ligne). */
export function useAnswerDue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ due, action, input }: { due: recurringApi.DueOperation; action: 'confirm' | 'skip'; input?: Omit<recurringApi.ConfirmDueInput, 'due_date'> }) =>
      offline.answerDue(due, action, input),
    onSuccess: (result, { due }) => {
      invalidateAfterMoneyMove(queryClient, due.recurring.activity, result);
      if (!isQueued(result)) void queryClient.invalidateQueries({ queryKey: ['recurring'] });
    },
  });
}
