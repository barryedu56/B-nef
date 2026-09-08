import { apiRequest } from './client';
import type { Paginated, Product, SaleLine, Transaction } from './types';

export async function listProducts(params: { activity: number; low_stock?: boolean; is_archived?: boolean }) {
  const data = await apiRequest<Paginated<Product>>('/products/', { params });
  return data.results;
}

export function fetchProduct(id: number) {
  return apiRequest<Product>(`/products/${id}/`);
}

/** Détail d'une vente : quels produits, en quelle quantité, à quel prix. */
export async function listSaleLines(transactionId: number) {
  const data = await apiRequest<Paginated<SaleLine>>('/sale-lines/', { params: { transaction: transactionId } });
  return data.results;
}

export interface ProductInput {
  activity: number;
  name: string;
  sku?: string;
  unit?: string;
  sale_price?: string;
  low_stock_threshold?: string | null;
  category?: string;
}

export function createProduct(input: ProductInput) {
  return apiRequest<Product>('/products/', { method: 'POST', body: input });
}

export function updateProduct(id: number, patch: Partial<ProductInput> & { is_archived?: boolean }) {
  return apiRequest<Product>(`/products/${id}/`, { method: 'PATCH', body: patch });
}

export interface SaleLineInput {
  product: number;
  quantity: string;
  unit_price?: string;
  discount?: string;
}

export interface SaleInput {
  activity: number;
  lines: SaleLineInput[];
  occurred_on?: string;
  payment_method?: number | null;
  party?: number | null;
  is_credit?: boolean;
  /** Vente à crédit avec acompte : ce que le client paie tout de suite. */
  amount_paid_now?: string;
  global_discount?: string;
  sale_currency?: string;
  note?: string;
}

export function createSale(input: SaleInput) {
  return apiRequest<Transaction>('/sales/', { method: 'POST', body: input });
}

export interface PurchaseInput {
  product: number;
  quantity: string;
  unit_cost: string;
  /** Frais annexes pour tout le lot (transport, douane…), pas par unité. */
  extra_fees?: string;
  cost_currency?: string;
  occurred_on?: string;
  payment_method?: number | null;
  party?: number | null;
  is_credit?: boolean;
  /** Réappro à crédit avec acompte : ce que tu paies tout de suite au fournisseur. */
  amount_paid_now?: string;
  /** Nouveau prix de vente à appliquer au produit après ce réappro. */
  sale_price?: string;
  note?: string;
}

export interface PurchaseResult {
  transaction: Transaction;
  product: { id: number; stock_quantity: string; purchase_price: string; sale_price?: string };
}

export function createPurchase(input: PurchaseInput) {
  return apiRequest<PurchaseResult>('/purchases/', { method: 'POST', body: input });
}

export interface StockAdjustmentInput {
  product: number;
  new_quantity: string;
  occurred_on?: string;
  note?: string;
}

export function adjustStock(input: StockAdjustmentInput) {
  return apiRequest<{ movement_id: number; product: { id: number; stock_quantity: string } }>(
    '/stock-adjustments/',
    { method: 'POST', body: input }
  );
}

export interface PersonalUseInput {
  product: number;
  quantity: string;
  occurred_on?: string;
  note?: string;
}

/** Retire du stock une quantité gardée pour soi (pas vendue) — valorisée
 * automatiquement au coût moyen actuel côté serveur. */
export function consumePersonalUse(input: PersonalUseInput) {
  return apiRequest<PurchaseResult>('/personal-use/', { method: 'POST', body: input });
}
