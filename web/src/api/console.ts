import { apiRequest } from './client';
import type { Paginated } from './types';

/** Console d'administration (/api/console/…), réservée aux administrateurs. */

export interface ConsoleOverview {
  users: {
    total: number;
    inactive: number;
    new_today: number;
    new_7d: number;
    new_30d: number;
    active_today: number;
    active_7d: number;
  };
  operations: { today: number; '7d': number; total: number };
  activities: number;
  products: number;
  series: { day: string; signups: number; operations: number }[];
  generated_at: string;
}

export interface FeedEvent {
  type: 'signup' | 'login' | 'operation';
  at: string;
  user_id: number;
  username: string;
  text: string;
  amount?: string;
  currency?: string;
  direction?: 'in' | 'out';
  voided?: boolean;
}

export interface ConsoleHealth {
  disk: { total: number; used: number; free: number };
  database_size: number | null;
  backup: { at: string | null; size: number; count: number; name?: string } | null;
  rates: { has_rates: boolean; last_fetched_at: string | null; last_as_of: string | null; stale: boolean };
  email_configured: boolean;
  debug: boolean;
  server_time: string;
}

export interface ConsoleUser {
  id: number;
  username: string;
  email: string;
  phone: string;
  is_active: boolean;
  is_staff: boolean;
  base_currency: string;
  date_joined: string;
  last_login: string | null;
  activities: number | null;
  operations: number | null;
  last_operation: string | null;
}

export interface ConsoleOperation {
  id: number;
  created_at: string;
  occurred_on: string;
  user_id: number;
  username: string;
  activity: string;
  kind: string;
  kind_display: string;
  direction: 'in' | 'out';
  amount: string;
  currency: string;
  payment_method: string | null;
  note: string;
  is_credit: boolean;
  voided: boolean;
  voided_reason: string;
}

export interface ConsoleUserDetail extends ConsoleUser {
  activities_list: {
    id: number;
    name: string;
    type: string;
    currency: string;
    is_archived: boolean;
    operations: number;
    created_at: string;
  }[];
  cash: { id: number; name: string; currency: string; balance: string }[];
  parties: number | null;
  recent_operations: ConsoleOperation[];
  admin_actions: { at: string; action: string; admin: string | null; details: Record<string, unknown> }[];
}

export interface ConsoleRate {
  base: string;
  quote: string;
  rate: string;
  as_of: string;
  source: string;
}

export interface JournalEntry {
  id: number;
  at: string;
  admin: string | null;
  action: string;
  target: string;
  target_user_id: number | null;
  details: Record<string, unknown>;
}

export type UserAction = 'deactivate' | 'reactivate' | 'logout' | 'temp-password';

/** Actualisation automatique de la console (en millisecondes). */
export const LIVE_INTERVAL = 10_000;

export const consoleApi = {
  overview: () => apiRequest<ConsoleOverview>('/console/overview/'),
  feed: () => apiRequest<FeedEvent[]>('/console/feed/'),
  health: () => apiRequest<ConsoleHealth>('/console/health/'),
  users: (params: { search?: string; status?: string; ordering?: string; page?: number }) =>
    apiRequest<Paginated<ConsoleUser>>('/console/users/', { params }),
  user: (id: number) => apiRequest<ConsoleUserDetail>(`/console/users/${id}/`),
  userAction: (id: number, action: UserAction) =>
    apiRequest<{ detail: string; password?: string }>(`/console/users/${id}/${action}/`, { method: 'POST' }),
  operations: (params: Record<string, string | number | undefined>) =>
    apiRequest<Paginated<ConsoleOperation>>('/console/operations/', { params }),
  voidOperation: (id: number, reason: string) =>
    apiRequest<{ detail: string }>(`/console/operations/${id}/void/`, { method: 'POST', body: { reason } }),
  rates: () => apiRequest<ConsoleRate[]>('/console/rates/'),
  addRate: (body: { base: string; quote: string; rate: string; as_of?: string }) =>
    apiRequest<{ detail: string }>('/console/rates/', { method: 'POST', body }),
  journal: (page: number) => apiRequest<Paginated<JournalEntry>>('/console/journal/', { params: { page } }),
};
