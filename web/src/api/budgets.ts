import { apiRequest } from './client';
import type { Budget, BudgetStatus } from './types';

export function fetchBudgetsStatus(params?: { activity?: number; date?: string }) {
  return apiRequest<BudgetStatus[]>('/budgets/status/', { params });
}

export interface BudgetInput {
  activity: number | null;
  category: number | null;
  period: Budget['period'];
  amount: string;
  currency: string;
  starts_on: string;
}

export function createBudget(input: BudgetInput) {
  return apiRequest<Budget>('/budgets/', { method: 'POST', body: input });
}

export function updateBudget(id: number, patch: Partial<BudgetInput>) {
  return apiRequest<Budget>(`/budgets/${id}/`, { method: 'PATCH', body: patch });
}

export function deleteBudget(id: number) {
  return apiRequest<void>(`/budgets/${id}/`, { method: 'DELETE' });
}
