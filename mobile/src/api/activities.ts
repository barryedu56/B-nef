import { apiRequest } from './client';
import type { Activity, Paginated } from './types';

export async function listActivities(params?: { is_archived?: boolean }) {
  const data = await apiRequest<Paginated<Activity>>('/activities/', { params });
  return data.results;
}

export function fetchActivity(id: number) {
  return apiRequest<Activity>(`/activities/${id}/`);
}

export interface ActivityInput {
  name: string;
  type: Activity['type'];
  currency: string;
  has_inventory?: boolean;
  has_debts?: boolean;
  has_budget?: boolean;
  opening_balance?: string;
}

export function createActivity(input: ActivityInput) {
  return apiRequest<Activity>('/activities/', { method: 'POST', body: input });
}

export function updateActivity(id: number, patch: Partial<ActivityInput> & { is_archived?: boolean }) {
  return apiRequest<Activity>(`/activities/${id}/`, { method: 'PATCH', body: patch });
}

export const ACTIVITY_TYPE_OPTIONS: { value: Activity['type']; label: string }[] = [
  { value: 'commerce', label: 'Commerce' },
  { value: 'service', label: 'Service / prestation' },
  { value: 'salary', label: 'Salaire / revenu fixe' },
  { value: 'rental', label: 'Location' },
  { value: 'farming', label: 'Agriculture / élevage' },
  { value: 'household', label: 'Ménage / dépenses' },
  { value: 'other', label: 'Autre' },
];
