import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as recurringApi from '@/api/recurring';
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

export function useAnswerDue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ due, action, input }: { due: recurringApi.DueOperation; action: 'confirm' | 'skip'; input?: Omit<recurringApi.ConfirmDueInput, 'due_date'> }) =>
      recurringApi.answerDue(due.recurring.id, action, { ...input, due_date: due.due_date }),
    onSuccess: (_result, { due }) => {
      invalidateAfterMoneyMove(queryClient, due.recurring.activity);
      void queryClient.invalidateQueries({ queryKey: ['recurring'] });
    },
  });
}
