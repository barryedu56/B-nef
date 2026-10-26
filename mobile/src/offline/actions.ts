/** Versions « utilisables hors-ligne » des opérations du quotidien. Les
 * autres (créer une activité, réglages du compte, photo…) restent en ligne
 * uniquement. */
import type { SettleInput, TransactionInput, TransferInput } from '@/api/finance';
import type {
  PersonalUseInput,
  ProductInput,
  PurchaseInput,
  PurchaseResult,
  SaleInput,
  StockAdjustmentInput,
} from '@/api/inventory';
import type { PartyInput } from '@/api/parties';
import type { Party, Product, Transaction } from '@/api/types';
import { todayISO } from '@/lib/dates';
import {
  addCachedParty,
  addCachedProduct,
  addCachedTransaction,
  cachedActivity,
  cachedProduct,
  patchCachedTransaction,
  pendingTransaction,
  updateCachedStock,
} from './optimistic';
import { nextTempId } from './outbox';
import { sendOrQueue } from './send';

function withActivityName(label: string, activityId: number | undefined) {
  const name = cachedActivity(activityId)?.name;
  return name ? `${label} — ${name}` : label;
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  // La date est toujours envoyée : synchronisée le lendemain, l'opération
  // doit rester à la date où elle a été faite.
  const body = { ...input, occurred_on: input.occurred_on || todayISO() };
  const tempId = await nextTempId();
  return sendOrQueue<Transaction>({
    label: withActivityName(input.direction === 'in' ? 'Entrée d’argent' : 'Sortie d’argent', input.activity),
    method: 'POST',
    path: '/transactions/',
    body,
    activityId: input.activity,
    optimistic: () => {
      const txn = pendingTransaction({ ...body, id: tempId, kind: body.kind ?? 'simple', amount: Number(body.amount) });
      addCachedTransaction(txn);
      return txn;
    },
  });
}

export async function createSale(input: SaleInput): Promise<Transaction> {
  const body = { ...input, occurred_on: input.occurred_on || todayISO() };
  const tempId = await nextTempId();
  return sendOrQueue<Transaction>({
    label: withActivityName('Vente', input.activity),
    method: 'POST',
    path: '/sales/',
    body,
    activityId: input.activity,
    offlineExtra: { recorded_offline: true },
    optimistic: () => {
      let total = 0;
      for (const line of input.lines) {
        const qty = Number(line.quantity);
        const price = Number(line.unit_price ?? cachedProduct(line.product)?.sale_price ?? 0);
        total += qty * price - Number(line.discount ?? 0);
        updateCachedStock(line.product, (current) => current - qty);
      }
      total -= Number(input.global_discount ?? 0);
      const txn = pendingTransaction({
        id: tempId,
        activity: input.activity,
        direction: 'in',
        kind: 'sale',
        amount: total,
        currency: input.sale_currency ?? cachedActivity(input.activity)?.currency ?? '',
        occurred_on: body.occurred_on,
        party: input.party,
        payment_method: input.payment_method,
        is_credit: input.is_credit,
        note: input.note,
      });
      addCachedTransaction(txn);
      return txn;
    },
  });
}

export async function createPurchase(input: PurchaseInput): Promise<PurchaseResult> {
  const body = { ...input, occurred_on: input.occurred_on || todayISO() };
  const product = cachedProduct(input.product);
  const tempId = await nextTempId();
  return sendOrQueue<PurchaseResult>({
    label: withActivityName(`Réapprovisionnement${product ? ` ${product.name}` : ''}`, product?.activity),
    method: 'POST',
    path: '/purchases/',
    body,
    activityId: product?.activity,
    optimistic: () => {
      const qty = Number(input.quantity);
      updateCachedStock(input.product, (current) => current + qty);
      const amount = qty * Number(input.unit_cost) + Number(input.extra_fees ?? 0);
      const txn = pendingTransaction({
        id: tempId,
        activity: product?.activity ?? 0,
        direction: 'out',
        kind: 'purchase',
        amount,
        currency: input.cost_currency ?? cachedActivity(product?.activity)?.currency ?? '',
        occurred_on: body.occurred_on,
        party: input.party,
        payment_method: input.payment_method,
        is_credit: input.is_credit,
        note: input.note,
      });
      if (product) addCachedTransaction(txn);
      const updated = cachedProduct(input.product);
      return {
        transaction: txn,
        product: {
          id: input.product,
          stock_quantity: updated?.stock_quantity ?? '0',
          purchase_price: updated?.purchase_price ?? input.unit_cost,
          sale_price: input.sale_price ?? updated?.sale_price,
        },
      };
    },
  });
}

export async function consumePersonalUse(input: PersonalUseInput): Promise<PurchaseResult> {
  const body = { ...input, occurred_on: input.occurred_on || todayISO() };
  const product = cachedProduct(input.product);
  const tempId = await nextTempId();
  return sendOrQueue<PurchaseResult>({
    label: withActivityName(`Consommation perso${product ? ` ${product.name}` : ''}`, product?.activity),
    method: 'POST',
    path: '/personal-use/',
    body,
    activityId: product?.activity,
    offlineExtra: { recorded_offline: true },
    optimistic: () => {
      const qty = Number(input.quantity);
      updateCachedStock(input.product, (current) => current - qty);
      const txn = pendingTransaction({
        id: tempId,
        activity: product?.activity ?? 0,
        direction: 'out',
        kind: 'personal_use',
        amount: qty * Number(product?.purchase_price ?? 0),
        currency: cachedActivity(product?.activity)?.currency ?? '',
        occurred_on: body.occurred_on,
        note: input.note,
      });
      if (product) addCachedTransaction(txn);
      const updated = cachedProduct(input.product);
      return {
        transaction: txn,
        product: {
          id: input.product,
          stock_quantity: updated?.stock_quantity ?? '0',
          purchase_price: updated?.purchase_price ?? '0',
        },
      };
    },
  });
}

export async function adjustStock(input: StockAdjustmentInput) {
  const body = { ...input, occurred_on: input.occurred_on || todayISO() };
  const product = cachedProduct(input.product);
  return sendOrQueue<{ movement_id: number; product: { id: number; stock_quantity: string } }>({
    label: withActivityName(`Ajustement de stock${product ? ` ${product.name}` : ''}`, product?.activity),
    method: 'POST',
    path: '/stock-adjustments/',
    body,
    activityId: product?.activity,
    optimistic: () => {
      updateCachedStock(input.product, () => Number(input.new_quantity));
      return { movement_id: 0, product: { id: input.product, stock_quantity: input.new_quantity } };
    },
  });
}

export async function settleTransaction(original: Transaction, input: SettleInput = {}): Promise<Transaction> {
  const body = { ...input, occurred_on: input.occurred_on || todayISO() };
  const tempId = await nextTempId();
  return sendOrQueue<Transaction>({
    label: withActivityName('Règlement', original.activity),
    method: 'POST',
    path: `/transactions/${original.id}/settle/`,
    body,
    activityId: original.activity,
    optimistic: () => {
      const remaining = Number(original.remaining_amount);
      const paid = input.amount ? Number(input.amount) : remaining;
      const settled = Number(original.settled_amount) + paid;
      patchCachedTransaction(original.id, {
        settled_amount: settled.toFixed(2),
        remaining_amount: Math.max(0, remaining - paid).toFixed(2),
        is_settled: paid >= remaining,
      });
      const txn = pendingTransaction({
        id: tempId,
        activity: original.activity,
        direction: original.direction,
        kind: 'settlement',
        amount: paid,
        currency: original.currency,
        occurred_on: body.occurred_on,
        party: original.party,
        payment_method: input.payment_method,
        note: input.note,
      });
      addCachedTransaction(txn);
      return txn;
    },
  });
}

export async function voidTransaction(txn: Transaction, reason = ''): Promise<Transaction> {
  return sendOrQueue<Transaction>({
    label: withActivityName('Annulation d’une opération', txn.activity),
    method: 'POST',
    path: `/transactions/${txn.id}/void/`,
    body: { reason },
    activityId: txn.activity,
    optimistic: () => {
      const patch = { voided_at: new Date().toISOString(), voided_reason: reason, is_voided: true };
      patchCachedTransaction(txn.id, patch);
      return { ...txn, ...patch };
    },
  });
}

export async function createParty(input: PartyInput): Promise<Party> {
  const tempId = await nextTempId();
  return sendOrQueue<Party>({
    label: `Nouveau tiers — ${input.name}`,
    method: 'POST',
    path: '/parties/',
    body: input,
    tempId,
    optimistic: () => {
      const party: Party = {
        id: tempId,
        name: input.name,
        phone: input.phone ?? '',
        kind: input.kind ?? 'client',
        note: input.note ?? '',
        is_archived: false,
        balance: '0.00',
      };
      addCachedParty(party);
      return party;
    },
  });
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const tempId = await nextTempId();
  return sendOrQueue<Product>({
    label: withActivityName(`Nouveau produit ${input.name}`, input.activity),
    method: 'POST',
    path: '/products/',
    body: input,
    activityId: input.activity,
    tempId,
    optimistic: () => {
      const product: Product = {
        id: tempId,
        activity: input.activity,
        name: input.name,
        sku: input.sku ?? '',
        unit: input.unit ?? 'pièce',
        purchase_price: '0.00',
        sale_price: input.sale_price ?? '0.00',
        stock_quantity: '0',
        low_stock_threshold: input.low_stock_threshold ?? null,
        category: input.category ?? '',
        is_archived: false,
        margin: '0.00',
        stock_value: '0.00',
        is_low_stock: false,
      };
      addCachedProduct(product);
      return product;
    },
  });
}

/** Transfert d'une caisse à l'autre (et/ou d'une activité à l'autre). Hors
 * ligne : mis en file ; les soldes se recalculent à la synchronisation. */
export async function createTransfer(input: TransferInput): Promise<{ out?: Transaction; in?: Transaction }> {
  const body = { ...input, occurred_on: input.occurred_on || todayISO() };
  return sendOrQueue<{ out?: Transaction; in?: Transaction }>({
    label: withActivityName('Transfert', input.from_activity),
    method: 'POST',
    path: '/transfers/',
    body,
    activityId: input.from_activity,
    optimistic: () => ({}),
  });
}
