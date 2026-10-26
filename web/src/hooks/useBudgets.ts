import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as budgetsApi from '@/api/budgets';

export function useBudgetsStatus(activityId?: number) {
  return useQuery({
    queryKey: ['budgets', 'status', activityId],
    queryFn: () => budgetsApi.fetchBudgetsStatus({ activity: activityId }),
  });
}

function useInvalidateBudgets() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['budgets'] });
}

export function useCreateBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({ mutationFn: budgetsApi.createBudget, onSuccess: invalidate });
}

export function useUpdateBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<budgetsApi.BudgetInput> }) =>
      budgetsApi.updateBudget(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({ mutationFn: budgetsApi.deleteBudget, onSuccess: invalidate });
}
