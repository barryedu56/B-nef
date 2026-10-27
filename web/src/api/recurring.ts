import { apiRequest } from './client';
import type { Paginated } from './types';

export type Frequency = 'weekly' | 'monthly' | 'yearly';

/** Dépense (ou entrée) fixe : loyer, salaire, abonnement… */
export interface RecurringOperation {
  id: number;
  activity: number;
  activity_name: string;
  label: string;
  direction: 'in' | 'out';
  amount: string;
  currency: string;
  category: number | null;
  category_name: string | null;
  payment_method: number | null;
  payment_method_name: string | null;
  frequency: Frequency;
  day: number;
  next_due: string;
  is_active: boolean;
}

export interface RecurringInput {
  activity: number;
  label: string;
  direction?: 'in' | 'out';
  amount: string;
  category?: number | null;
  payment_method?: number | null;
  frequency: Frequency;
  /** Date de la première échéance (fixe aussi le jour des suivantes). */
  start_date?: string;
  is_active?: boolean;
}

/** Une échéance arrivée, à confirmer. */
export interface DueOperation {
  due_date: string;
  recurring: RecurringOperation;
}

export interface ConfirmDueInput {
  due_date: string;
  amount?: string;
  payment_method?: number | null;
  fee?: string;
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Chaque semaine',
  monthly: 'Chaque mois',
  yearly: 'Chaque année',
};

export async function listRecurring() {
  const data = await apiRequest<Paginated<RecurringOperation>>('/recurring/');
  return data.results;
}

export function listDue() {
  return apiRequest<DueOperation[]>('/recurring/due/');
}

export function createRecurring(input: RecurringInput) {
  return apiRequest<RecurringOperation>('/recurring/', { method: 'POST', body: input });
}

export function updateRecurring(id: number, patch: Partial<RecurringInput>) {
  return apiRequest<RecurringOperation>(`/recurring/${id}/`, { method: 'PATCH', body: patch });
}

export function deleteRecurring(id: number) {
  return apiRequest<void>(`/recurring/${id}/`, { method: 'DELETE' });
}

/** Confirmer (enregistre l'opération) ou passer une échéance. */
export function answerDue(id: number, action: 'confirm' | 'skip', input: ConfirmDueInput) {
  return apiRequest<unknown>(`/recurring/${id}/${action}/`, { method: 'POST', body: input });
}
