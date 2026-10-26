/** Télécharge à l'avance ce qu'il faut pour travailler sans réseau : sans
 * ça, un écran jamais ouvert en ligne (ex. la liste des produits d'une
 * boutique) serait vide une fois hors-ligne et on ne pourrait rien vendre.
 *
 * Les clés et fonctions doivent rester identiques à celles des hooks
 * (src/hooks/use*.ts), sinon les écrans ne retrouvent pas ces données.
 */
import { onlineManager } from '@tanstack/react-query';

import * as activitiesApi from '@/api/activities';
import * as budgetsApi from '@/api/budgets';
import * as financeApi from '@/api/finance';
import * as inventoryApi from '@/api/inventory';
import * as partiesApi from '@/api/parties';
import { queryClient } from './queryClient';

const MIN_INTERVAL = 5 * 60_000;
let lastRun = 0;
let running: Promise<void> | null = null;

export function warmOfflineCache(force = false): Promise<void> {
  if (!onlineManager.isOnline()) return Promise.resolve();
  if (!force && Date.now() - lastRun < MIN_INTERVAL) return Promise.resolve();
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run() {
  lastRun = Date.now();
  try {
    const activities = await queryClient.fetchQuery({
      queryKey: ['activities'],
      queryFn: () => activitiesApi.listActivities({ is_archived: false }),
    });
    const jobs: Promise<unknown>[] = [
      queryClient.prefetchQuery({ queryKey: ['payment-methods'], queryFn: financeApi.listPaymentMethods }),
      queryClient.prefetchQuery({ queryKey: ['accounts', 'overview'], queryFn: financeApi.fetchAccountsOverview }),
      queryClient.prefetchQuery({
        queryKey: ['budgets', 'status', undefined],
        queryFn: () => budgetsApi.fetchBudgetsStatus({ activity: undefined }),
      }),
      ...([undefined, 'in', 'out'] as const).map((direction) =>
        queryClient.prefetchQuery({
          queryKey: ['categories', direction],
          queryFn: () => financeApi.listCategories({ direction }),
        })
      ),
      ...([undefined, 'client', 'supplier'] as const).map((kind) =>
        queryClient.prefetchQuery({
          queryKey: ['parties', kind],
          queryFn: () => partiesApi.listParties({ kind, is_archived: false }),
        })
      ),
    ];
    for (const activity of activities) {
      queryClient.setQueryData(['activities', activity.id], activity);
      jobs.push(
        queryClient.prefetchQuery({
          queryKey: ['transactions', activity.id],
          queryFn: () => financeApi.listTransactions({ activity: activity.id }),
        })
      );
      if (activity.has_inventory) {
        jobs.push(
          queryClient.prefetchQuery({
            queryKey: ['products', activity.id, undefined, false],
            queryFn: () => inventoryApi.listProducts({ activity: activity.id, low_stock: undefined, is_archived: false }),
          })
        );
      }
    }
    await Promise.allSettled(jobs);
  } catch {
    lastRun = 0; // réessaiera à la prochaine occasion
  }
}
