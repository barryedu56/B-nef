import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import * as inventoryApi from '@/api/inventory';
import type { Activity, Product } from '@/api/types';
import { invalidateAfterMoneyMove } from './useTransactions';

export function useProducts(activityId: number | undefined, opts?: { lowStock?: boolean; archived?: boolean }) {
  return useQuery({
    queryKey: ['products', activityId, opts?.lowStock, opts?.archived ?? false],
    queryFn: () =>
      inventoryApi.listProducts({ activity: activityId as number, low_stock: opts?.lowStock, is_archived: opts?.archived ?? false }),
    enabled: activityId !== undefined,
  });
}

export function useUpdateProduct(activityId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof inventoryApi.updateProduct>[1] }) =>
      inventoryApi.updateProduct(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', activityId] }),
  });
}

/** Le détail (produits/quantités/prix) d'une vente — pour le détail d'une
 * opération. `enabled` seulement pour les transactions kind=sale. */
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

/** Produits en stock faible ou en rupture, agrégés sur toutes les activités
 * avec module inventaire (nombre de requêtes variable -> useQueries, pas une
 * boucle de useQuery). */
export function useLowStockAcrossActivities(activities: Activity[] | undefined) {
  const withInventory = (activities ?? []).filter((a) => a.has_inventory);
  const results = useQueries({
    queries: withInventory.map((activity) => ({
      queryKey: ['products', activity.id, false],
      queryFn: () => inventoryApi.listProducts({ activity: activity.id, is_archived: false }),
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const rows: { activity: Activity; product: Product }[] = [];
  withInventory.forEach((activity, i) => {
    const products = results[i]?.data ?? [];
    for (const product of products) {
      if (product.is_low_stock || Number(product.stock_quantity) <= 0) rows.push({ activity, product });
    }
  });
  rows.sort((a, b) => Number(a.product.stock_quantity) - Number(b.product.stock_quantity));
  return { rows, isLoading };
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
