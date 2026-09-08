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

export interface PaymentMethod {
  id: number
  name: string
  is_cash: boolean
}

export type TransactionKind =
  | 'simple'
  | 'sale'
  | 'purchase'
  | 'settlement'
  | 'adjustment'
  | 'opening_balance'
  | 'personal_use'

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
