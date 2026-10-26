/** Mises à jour locales des données affichées pour une opération en
 * attente : le stock baisse tout de suite après une vente, l'opération
 * apparaît dans la liste, un nouveau client est sélectionnable… Le serveur
 * remplace tout ça par les vrais chiffres à la synchronisation. */
import type { Activity, Direction, Paginated, Party, Product, Transaction, TransactionKind } from '@/api/types';
import { queryClient } from './queryClient';

function asDecimal(value: number) {
  return value.toFixed(2);
}

export function cachedActivity(id: number | undefined): Activity | undefined {
  if (id === undefined) return undefined;
  const direct = queryClient.getQueryData<Activity>(['activities', id]);
  if (direct) return direct;
  for (const [, data] of queryClient.getQueriesData<Activity[]>({ queryKey: ['activities'] })) {
    const found = Array.isArray(data) ? data.find((a) => a.id === id) : undefined;
    if (found) return found;
  }
  return undefined;
}

export function cachedProduct(id: number): Product | undefined {
  for (const [, data] of queryClient.getQueriesData<Product[] | Product>({ queryKey: ['products'] })) {
    if (Array.isArray(data)) {
      const found = data.find((p) => p.id === id);
      if (found) return found;
    } else if (data && data.id === id) {
      return data;
    }
  }
  return undefined;
}

/** Change le stock d'un produit partout où il est affiché. */
export function updateCachedStock(productId: number, compute: (current: number) => number) {
  const patch = (p: Product): Product => {
    if (p.id !== productId) return p;
    const qty = compute(Number(p.stock_quantity));
    const threshold = p.low_stock_threshold === null ? null : Number(p.low_stock_threshold);
    return {
      ...p,
      stock_quantity: String(qty),
      stock_value: asDecimal(qty * Number(p.purchase_price)),
      is_low_stock: threshold !== null ? qty <= threshold : p.is_low_stock,
    };
  };
  queryClient.setQueriesData<Product[] | Product>({ queryKey: ['products'] }, (data) => {
    if (Array.isArray(data)) return data.map(patch);
    if (data && typeof data === 'object' && 'stock_quantity' in data) return patch(data);
    return data;
  });
}

export function addCachedProduct(product: Product) {
  for (const [key, data] of queryClient.getQueriesData<Product[]>({ queryKey: ['products', product.activity] })) {
    // Clé : ['products', activityId, lowStock, archived] — seulement la liste des produits actifs.
    if (Array.isArray(data) && key[3] === false && !key[2]) {
      queryClient.setQueryData(key, [...data, product]);
    }
  }
}

export function addCachedParty(party: Party) {
  for (const [key, data] of queryClient.getQueriesData<Party[]>({ queryKey: ['parties'] })) {
    const kindFilter = key[1];
    const matches = kindFilter === undefined || kindFilter === party.kind || party.kind === 'both';
    if (Array.isArray(data) && matches) queryClient.setQueryData(key, [party, ...data]);
  }
}

export interface PendingTransactionInput {
  id: number;
  activity: number;
  direction: Direction;
  kind: TransactionKind;
  amount: number;
  currency: string;
  occurred_on: string;
  party?: number | null;
  category?: number | null;
  payment_method?: number | null;
  note?: string;
  is_credit?: boolean;
}

export function pendingTransaction(input: PendingTransactionInput): Transaction {
  const amount = asDecimal(input.amount);
  return {
    id: input.id,
    activity: input.activity,
    direction: input.direction,
    kind: input.kind,
    kind_display: '',
    amount,
    currency: input.currency,
    amount_activity: amount,
    amount_base: amount,
    fx_rate_to_base: '1',
    fx_date: input.occurred_on,
    category: input.category ?? null,
    payment_method: input.payment_method ?? null,
    party: input.party ?? null,
    occurred_on: input.occurred_on,
    note: input.note ?? '',
    is_credit: !!input.is_credit,
    settled_amount: '0.00',
    remaining_amount: input.is_credit ? amount : '0.00',
    is_settled: false,
    settles: null,
    created_at: new Date().toISOString(),
    voided_at: null,
    voided_reason: '',
    is_voided: false,
  };
}

/** Ajoute l'opération en tête de la liste de l'activité. */
export function addCachedTransaction(txn: Transaction) {
  queryClient.setQueriesData<Paginated<Transaction>>({ queryKey: ['transactions', txn.activity] }, (data) =>
    data && Array.isArray(data.results) ? { ...data, count: data.count + 1, results: [txn, ...data.results] } : data
  );
}

export function patchCachedTransaction(id: number, patch: Partial<Transaction>) {
  queryClient.setQueryData<Transaction>(['transactions', 'detail', id], (t) => (t ? { ...t, ...patch } : t));
  queryClient.setQueriesData<Paginated<Transaction>>({ queryKey: ['transactions'] }, (data) =>
    data && Array.isArray(data.results)
      ? { ...data, results: data.results.map((t) => (t.id === id ? { ...t, ...patch } : t)) }
      : data
  );
}
