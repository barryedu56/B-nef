import { API_URL, apiRequest, ApiError, getTokens } from './client';
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

/** Télécharge le vrai fichier PDF du rapport (pas `apiRequest` : réponse
 * binaire, pas JSON) et déclenche l'enregistrement dans le navigateur. */
export async function downloadReportPdf(params: { activity?: number; period: Period; date?: string }) {
  const url = new URL(`${API_URL}/reports/pdf/`);
  if (params.activity !== undefined) url.searchParams.set('activity', String(params.activity));
  url.searchParams.set('period', params.period);
  if (params.date) url.searchParams.set('date', params.date);

  const { access } = getTokens();
  const res = await fetch(url.toString(), {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });
  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      // pas de corps JSON
    }
    throw new ApiError(res.status, payload);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  // Préfère filename* (UTF-8, RFC 5987) au filename="" simple ASCII, sinon un
  // nom d'activité accentué perdrait ses accents dans le fichier téléchargé.
  const utf8Match = /filename\*=UTF-8''([^;]+)/.exec(disposition);
  const asciiMatch = /filename="([^"]+)"/.exec(disposition);
  const filename = utf8Match ? decodeURIComponent(utf8Match[1]) : asciiMatch ? asciiMatch[1] : 'rapport.pdf';

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
