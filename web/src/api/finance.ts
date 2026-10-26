import { apiRequest } from './client';
import type {
  CashFlow,
  AccountsOverview,
  CashCount,
  Category,
  Direction,
  Paginated,
  PaymentMethod,
  Transaction,
  TransactionKind,
} from './types';

export async function listCategories(params?: { activity?: number; direction?: Direction }) {
  const data = await apiRequest<Paginated<Category>>('/categories/', { params });
  return data.results;
}

export function createCategory(input: { activity?: number; name: string; direction: Direction }) {
  return apiRequest<Category>('/categories/', { method: 'POST', body: input });
}

export async function listPaymentMethods() {
  const data = await apiRequest<Paginated<PaymentMethod>>('/payment-methods/');
  return data.results;
}

export function createPaymentMethod(input: { name: string; is_cash?: boolean }) {
  return apiRequest<PaymentMethod>('/payment-methods/', { method: 'POST', body: input });
}

export interface TransactionListParams {
  activity?: number;
  direction?: Direction;
  kind?: TransactionKind;
  party?: number;
  payment_method?: number;
  cash_only?: boolean;
  page?: number;
  ordering?: string;
  [key: string]: string | number | boolean | undefined | null;
}

export function listTransactions(params: TransactionListParams) {
  return apiRequest<Paginated<Transaction>>('/transactions/', { params });
}

export interface TransactionInput {
  activity: number;
  direction: Direction;
  amount: string;
  currency: string;
  occurred_on: string;
  kind?: TransactionKind;
  category?: number | null;
  payment_method?: number | null;
  party?: number | null;
  note?: string;
  is_credit?: boolean;
}

export function createTransaction(input: TransactionInput) {
  return apiRequest<Transaction>('/transactions/', { method: 'POST', body: input });
}

export function fetchTransaction(id: number) {
  return apiRequest<Transaction>(`/transactions/${id}/`);
}

/** Après création, seuls ces champs restent modifiables — montant, devise,
 * sens et date ne changent jamais : on annule (`voidTransaction`) et on
 * ressaisit plutôt que de les corriger en place. */
export interface TransactionSafeUpdate {
  category?: number | null;
  payment_method?: number | null;
  party?: number | null;
  note?: string;
}

export function updateTransaction(id: number, patch: TransactionSafeUpdate) {
  return apiRequest<Transaction>(`/transactions/${id}/`, { method: 'PATCH', body: patch });
}

export function voidTransaction(id: number, reason: string = '') {
  return apiRequest<Transaction>(`/transactions/${id}/void/`, { method: 'POST', body: { reason } });
}

export interface SettleInput {
  amount?: string;
  payment_method?: number | null;
  occurred_on?: string;
  note?: string;
  /** Frais de l'opérateur (Orange Money, banque…) payés en plus : une charge. */
  fee?: string;
}

export function settleTransaction(id: number, input: SettleInput = {}) {
  return apiRequest<Transaction>(`/transactions/${id}/settle/`, { method: 'POST', body: input });
}

export function updateCategory(id: number, patch: { name: string }) {
  return apiRequest<Category>(`/categories/${id}/`, { method: 'PATCH', body: patch });
}

export function deleteCategory(id: number) {
  return apiRequest<void>(`/categories/${id}/`, { method: 'DELETE' });
}

export function updatePaymentMethod(id: number, patch: { name?: string; is_cash?: boolean }) {
  return apiRequest<PaymentMethod>(`/payment-methods/${id}/`, { method: 'PATCH', body: patch });
}

export function deletePaymentMethod(id: number) {
  return apiRequest<void>(`/payment-methods/${id}/`, { method: 'DELETE' });
}

export function fetchAccountsOverview() {
  return apiRequest<AccountsOverview>('/payment-methods/overview/');
}

export function countCash(accountId: number, input: { counted: string; activity: number; note?: string }) {
  return apiRequest<CashCount>(`/payment-methods/${accountId}/count/`, { method: 'POST', body: input });
}

export function listCashCounts(accountId: number) {
  return apiRequest<CashCount[]>(`/payment-methods/${accountId}/counts/`);
}

export interface TransferInput {
  from_account: number;
  to_account: number;
  from_activity: number;
  to_activity?: number;
  amount: string;
  currency?: string;
  occurred_on?: string;
  note?: string;
  /** Frais de l'opérateur (Orange Money, banque…) payés en plus : une charge. */
  fee?: string;
}

export function createTransfer(input: TransferInput) {
  return apiRequest<{ out: Transaction; in: Transaction }>('/transfers/', { method: 'POST', body: input });
}

/** Entrées et sorties d'argent de chaque caisse sur une période. */
export function fetchCashFlow(params: { period: string; date?: string }) {
  return apiRequest<CashFlow>('/payment-methods/flow/', { params });
}
