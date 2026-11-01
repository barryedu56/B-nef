/** Télécharge à l'avance ce qu'il faut pour travailler sans réseau : sans
 * ça, un écran jamais ouvert en ligne (ex. la liste des produits d'une
 * boutique) serait vide une fois hors-ligne et on ne pourrait rien vendre.
 *
 * Les clés et fonctions doivent rester identiques à celles des hooks
 * (src/hooks/use*.ts), sinon les écrans ne retrouvent pas ces données.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';

import * as activitiesApi from '@/api/activities';
import * as budgetsApi from '@/api/budgets';
import * as financeApi from '@/api/finance';
import * as inventoryApi from '@/api/inventory';
import * as partiesApi from '@/api/parties';
import { fetchActivitySummary, fetchGlobalSummary } from '@/api/reports';
import type { Me, Paginated, Period, Transaction } from '@/api/types';
import { todayISO } from '@/lib/dates';
import { queryClient } from './queryClient';

const PERIODS: Period[] = ['day', 'week', 'month', 'year'];
/** Relevés de tiers gardés au plus : le stockage du navigateur (version
 * installée sur iPhone) est limité à ~5 Mo. Ceux qui ont un solde d'abord. */
const MAX_PARTIES = 30;

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
      queryClient.prefetchQuery({ queryKey: ['accounts', 'overview', null], queryFn: () => financeApi.fetchAccountsOverview(null) }),
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
      ...(['client', 'supplier'] as const).map((kind) =>
        queryClient.prefetchQuery({
          queryKey: ['parties', kind],
          queryFn: () => partiesApi.listParties({ kind, is_archived: false }),
        })
      ),
    ];
    // Tableaux de bord, résumés et entrées/sorties du jour, pour chaque
    // période (ce qu'affichent les écrans à l'ouverture).
    const today = todayISO();
    const me = JSON.parse((await AsyncStorage.getItem('benef-me')) ?? 'null') as Me | null;
    const currency = me?.effective_display_currency ?? 'GNF';
    for (const period of PERIODS) {
      jobs.push(
        queryClient.prefetchQuery({
          queryKey: ['reports', 'global', period, currency, today],
          queryFn: () => fetchGlobalSummary({ period, currency, date: today }),
        })
      );
      for (const activity of [null, ...activities.map((a) => a.id)]) {
        jobs.push(
          queryClient.prefetchQuery({
            queryKey: ['accounts', 'flow', period, today, activity],
            queryFn: () => financeApi.fetchCashFlow({ period, date: today, activity }),
          })
        );
      }
    }
    for (const activity of activities) {
      queryClient.setQueryData(['activities', activity.id], activity);
      jobs.push(
        queryClient
          .fetchQuery({
            queryKey: ['transactions', activity.id],
            queryFn: () => financeApi.listTransactions({ activity: activity.id }),
          })
          .then(keepSaleLines)
      );
      for (const period of PERIODS) {
        jobs.push(
          queryClient.prefetchQuery({
            queryKey: ['reports', 'activity', activity.id, period, undefined, today],
            queryFn: () => fetchActivitySummary(activity.id, { period, date: today }),
          })
        );
      }
      if (activity.has_budget) {
        jobs.push(
          queryClient.prefetchQuery({
            queryKey: ['budgets', 'status', activity.id],
            queryFn: () => budgetsApi.fetchBudgetsStatus({ activity: activity.id }),
          })
        );
      }
      if (activity.has_inventory) {
        jobs.push(
          queryClient.prefetchQuery({
            queryKey: ['products', activity.id, undefined, false],
            queryFn: () => inventoryApi.listProducts({ activity: activity.id, low_stock: undefined, is_archived: false }),
          })
        );
      }
    }
    // Relevé de chaque client / fournisseur (fiche tiers).
    jobs.push(
      queryClient
        .fetchQuery({
          queryKey: ['parties', undefined],
          queryFn: () => partiesApi.listParties({ kind: undefined, is_archived: false }),
        })
        .then((parties) =>
          Promise.allSettled(
            [...parties]
              .sort((x, y) => Math.abs(Number(y.balance)) - Math.abs(Number(x.balance)))
              .slice(0, MAX_PARTIES)
              .map((party) => {
                queryClient.setQueryData(['parties', 'detail', party.id], (old: unknown) => old ?? party);
                return queryClient.prefetchQuery({
                  queryKey: ['transactions', 'party', party.id],
                  queryFn: () => financeApi.listTransactions({ party: party.id, ordering: '-occurred_on' }),
                });
              })
          )
        )
    );
    await Promise.allSettled(jobs);
  } catch {
    lastRun = 0; // réessaiera à la prochaine occasion
  }
}

/** Détail des ventes déjà listées : affiché hors connexion sur la fiche d'une
 * vente. Une seule requête par activité. */
async function keepSaleLines(page: Paginated<Transaction>) {
  const sales = page.results.filter((t) => t.kind === 'sale');
  if (!sales.length) return;
  const lines = await inventoryApi.listSaleLinesOf(sales.map((t) => t.id));
  for (const sale of sales) {
    queryClient.setQueryData(
      ['sale-lines', sale.id],
      lines.filter((line) => line.transaction === sale.id)
    );
  }
}
