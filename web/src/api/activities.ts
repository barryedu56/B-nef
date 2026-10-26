import { apiRequest } from './client';
import type { Activity, OnboardingInput, OnboardingResult, Paginated, ProductImport } from './types';
import { downloadFile } from './reports';

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
  /** Caisse où va la somme de départ (Espèces si vide). */
  opening_account?: number | null;
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

/** Assistant de démarrage : argent par caisse, marchandise déjà en stock,
 * dettes et créances d'avant Bénef, enregistrés en une fois. */
export function submitOnboarding(activityId: number, input: OnboardingInput) {
  return apiRequest<OnboardingResult>(`/activities/${activityId}/onboarding/`, { method: 'POST', body: input });
}

/** Lit un fichier Excel / CSV de produits sans rien enregistrer. */
export function parseProductFile(file: File) {
  const body = new FormData();
  body.append('file', file);
  return apiRequest<ProductImport>('/products/import-parse/', { method: 'POST', body });
}

export function downloadProductTemplate() {
  return downloadFile('/products/import-template/', {}, 'benef-modele-produits.xlsx');
}
