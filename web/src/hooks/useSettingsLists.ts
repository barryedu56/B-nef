import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as financeApi from '@/api/finance';

/** Création / renommage / suppression des catégories et moyens de paiement
 * (écran Paramètres). Les listes elles-mêmes : useCategories / usePaymentMethods. */
export function useCategoryMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['categories'] });
  return {
    create: useMutation({ mutationFn: financeApi.createCategory, onSuccess }),
    rename: useMutation({
      mutationFn: ({ id, name }: { id: number; name: string }) => financeApi.updateCategory(id, { name }),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: financeApi.deleteCategory, onSuccess }),
  };
}

export function usePaymentMethodMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
  return {
    create: useMutation({ mutationFn: financeApi.createPaymentMethod, onSuccess }),
    rename: useMutation({
      mutationFn: ({ id, name }: { id: number; name: string }) => financeApi.updatePaymentMethod(id, { name }),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: financeApi.deletePaymentMethod, onSuccess }),
  };
}
