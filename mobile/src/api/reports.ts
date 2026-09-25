import { apiRequest } from './client';
import type { ActivitySummary, GlobalSummary, Period } from './types';

export function fetchActivitySummary(
  activityId: number,
  params: { period: Period; currency?: string; date?: string }
) {
  return apiRequest<ActivitySummary>(`/reports/activity/${activityId}/`, { params });
}

export function fetchGlobalSummary(params: { period: Period; currency?: string; date?: string }) {
  return apiRequest<GlobalSummary>('/reports/global/', { params });
}
