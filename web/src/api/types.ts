export type Direction = 'in' | 'out'

export type ActivityType =
  | 'commerce'
  | 'service'
  | 'salary'
  | 'rental'
  | 'farming'
  | 'household'
  | 'other'

export interface Currency {
  code: string
  name: string
  symbol: string
  decimal_places: number
  is_active: boolean
  sort_order: number
}

export interface Activity {
  id: number
  name: string
  type: ActivityType
  type_display: string
  currency: string
  has_inventory: boolean
  has_debts: boolean
  has_budget: boolean
  opening_balance: string
  is_archived: boolean
  created_at: string
}

export interface Category {
  id: number
  activity: number | null
  name: string
  direction: Direction
  is_system: boolean
}

/** Moyen de paiement = caisse (Espèces, Orange Money, Banque…). `balance`
 * est dans `effective_currency` (devise de la caisse, sinon principale). */
export interface PaymentMethod {
  id: number
  name: string
  is_cash: boolean
  currency: string | null
  effective_currency: string
  balance: string | null
}

export interface AccountOverviewRow extends PaymentMethod {
  last_count: { at: string; difference: string } | null
}

/** Tout l'argent : total dans la devise principale (taux du jour). */
export interface AccountsOverview {
  currency: string
  total: string
  unassigned: string
  accounts: AccountOverviewRow[]
}

export interface CashCount {
  id: number
  payment_method: number
  activity: number
  activity_name: string
  currency: string
  expected: string
  counted: string
  difference: string
  transaction: number | null
  note: string
  created_at: string
}

export type TransactionKind =
  | 'simple'
  | 'sale'
  | 'purchase'
  | 'settlement'
  | 'adjustment'
  | 'opening_balance'
  | 'personal_use'
  | 'contribution'
  | 'withdrawal'
  | 'transfer'
  | 'cash_adjustment'
  | 'fee'

export interface Transaction {
  id: number
  activity: number
  direction: Direction
  kind: TransactionKind
  kind_display: string
  amount: string
  currency: string
  amount_activity: string
  amount_base: string
  fx_rate_to_base: string
  fx_date: string
  category: number | null
  payment_method: number | null
  party: number | null
  occurred_on: string
  note: string
  is_credit: boolean
  settled_amount: string
  remaining_amount: string
  is_settled: boolean
  settles: number | null
  created_at: string
  voided_at: string | null
  voided_reason: string
  is_voided: boolean
  /** Frais de transfert : l'opération qui les a causés. */
  fee_for?: number | null
  /** Frais (Orange Money, banque…) payés en plus de cette opération. */
  fees_total?: string
}

export interface Product {
  id: number
  activity: number
  name: string
  sku: string
  unit: string
  purchase_price: string
  sale_price: string
  stock_quantity: string
  low_stock_threshold: string | null
  category: string
  is_archived: boolean
  margin: string
  stock_value: string
  is_low_stock: boolean
}

export interface SaleLine {
  id: number
  transaction: number
  product: number
  product_name: string
  quantity: string
  unit_price: string
  unit_cost: string
  discount: string
  line_total: string
  line_margin: string
}

export type PartyKind = 'client' | 'supplier' | 'both'

export interface Party {
  id: number
  name: string
  phone: string
  kind: PartyKind
  note: string
  is_archived: boolean
  balance: string
}

export interface Budget {
  id: number
  activity: number | null
  category: number | null
  period: 'week' | 'month' | 'year'
  amount: string
  currency: string
  starts_on: string
}

export type BudgetStatusLevel = 'ok' | 'warning' | 'over'

/** Dépensé / prévu d'un budget sur sa période en cours (`/budgets/status/`). */
export interface BudgetStatus {
  id: number
  activity: number | null
  activity_name: string | null
  category: number | null
  category_name: string | null
  period: Budget['period']
  period_start: string
  period_end: string
  currency: string
  planned: string
  spent: string
  remaining: string
  ratio: string
  status: BudgetStatusLevel
}

export interface Me {
  id: number
  username: string
  email: string
  phone: string
  language: string
  avatar: string | null
  base_currency: string
  display_currency: string | null
  effective_display_currency: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Summary {
  currency: string
  period_start: string
  period_end: string
  revenue: string
  cogs: string
  gross_margin: string
  expenses: string
  // Pertes (ou surplus si négatif) constatées à l'inventaire, déjà incluses dans `expenses`.
  stock_losses: string
  // Écarts constatés en comptant les caisses, déjà inclus dans `expenses`.
  cash_differences: string
  // Marchandise achetée sur la période (de l'argent sorti, pas une charge : elle
  // devient une charge quand elle est vendue, via le coût des ventes).
  purchases: string
  net_profit: string
  personal_use: string
  stock_value: string
  cash_balance: string
  receivable: string
  payable: string
  source_currency: string
  display_currency: string
  converted: boolean
  conversion_error?: string
}

export interface TimeseriesPoint {
  month: string
  net_profit: string
  currency: string
}

export interface ActivitySummary extends Summary {
  activity: { id: number; name: string; currency: string }
  timeseries: TimeseriesPoint[]
}

export interface ActivityBreakdownRow {
  activity_id: number
  name: string
  type: ActivityType
  net_profit: string
  revenue: string
  currency: string
}

export interface GlobalSummary extends Summary {
  patrimoine: string
  by_activity: ActivityBreakdownRow[]
  timeseries: TimeseriesPoint[]
}

export type Period = 'day' | 'week' | 'month' | 'year'

export type FlowGroups = Record<string, string>

/** Entrées et sorties d'argent d'une caisse (ou de toutes) sur une période. */
export interface CashFlowBlock {
  opening: string
  in: FlowGroups
  out: FlowGroups
  total_in: string
  total_out: string
  closing: string
}

export interface CashFlow {
  period_start: string
  period_end: string
  currency: string
  labels: { in: Record<string, string>; out: Record<string, string> }
  totals: CashFlowBlock
  accounts: (CashFlowBlock & { id: number; name: string; is_cash: boolean; currency: string })[]
}

/** Bilan d'un tiers (devise principale). */
export interface PartyStatement {
  currency: string
  bought: string
  paid: string
  sold: string
  received: string
  owed_to_party: string
  owed_by_party: string
  last_operation: string | null
}

export interface OnboardingProduct {
  name: string
  unit?: string
  quantity: string
  unit_cost: string
  sale_price: string
  low_stock_threshold?: string | null
}

export interface OnboardingInput {
  cash: { account: number; amount: string }[]
  products: OnboardingProduct[]
  parties: { name: string; phone?: string; direction: 'in' | 'out'; amount: string }[]
}

export interface OnboardingResult {
  currency: string
  cash_total: string
  stock_value: string
  receivable: string
  payable: string
  products: number
  parties: number
}

/** Lecture d'un fichier Excel / CSV de produits, avant enregistrement. */
export interface ProductImport {
  products: OnboardingProduct[]
  errors: { line: number; name: string; message: string }[]
  truncated: boolean
  max_rows: number
}
