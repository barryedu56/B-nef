import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as inventoryApi from '@/api/inventory';
import type { Product } from '@/api/types';
import { invalidateAfterMoneyMove } from './useTransactions';

export function useProducts(activityId: number | undefined, opts?: { lowStock?: boolean; archived?: boolean }) {
  return useQuery({
    queryKey: ['products', activityId, opts?.lowStock, opts?.archived ?? false],
    queryFn: () =>
      inventoryApi.listProducts({ activity: activityId as number, low_stock: opts?.lowStock, is_archived: opts?.archived ?? false }),
    enabled: activityId !== undefined,
  });
}

export function useProduct(id: number | undefined) {
  return useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: () => inventoryApi.fetchProduct(id as number),
    enabled: id !== undefined,
  });
}

/** Le détail (produits/quantités/prix) d'une vente — pour l'écran de détail
 * d'une opération. `enabled` seulement pour les transactions kind=sale. */
export function useSaleLines(transactionId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['sale-lines', transactionId],
    queryFn: () => inventoryApi.listSaleLines(transactionId as number),
    enabled: enabled && transactionId !== undefined,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.createProduct,
    onSuccess: (product) => queryClient.invalidateQueries({ queryKey: ['products', product.activity] }),
  });
}

export function useUpdateProduct(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof inventoryApi.updateProduct>[1]) => inventoryApi.updateProduct(id, patch),
    onSuccess: (product: Product) => {
      queryClient.invalidateQueries({ queryKey: ['products', product.activity] });
      queryClient.setQueryData(['products', 'detail', id], product);
    },
  });
}

/** Même chose que `useUpdateProduct`, mais pour une liste où l'id cible varie
 * ligne par ligne (ex. réactiver un produit archivé depuis la liste). */
export function useUpdateProductInList(activityId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof inventoryApi.updateProduct>[1] }) =>
      inventoryApi.updateProduct(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', activityId] }),
  });
}

export function useCreateSale(activityId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.createSale,
    onSuccess: () => invalidateAfterMoneyMove(queryClient, activityId),
  });
}

export function useCreatePurchase(activityId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.createPurchase,
    onSuccess: () => invalidateAfterMoneyMove(queryClient, activityId),
  });
}

export function useCreatePersonalUse(activityId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.consumePersonalUse,
    onSuccess: () => invalidateAfterMoneyMove(queryClient, activityId),
  });
}

export function useAdjustStock(activityId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.adjustStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', activityId] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'activity', activityId] });
    },
  });
}
