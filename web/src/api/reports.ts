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

/** Télécharge un fichier généré par l'API (pas `apiRequest` : réponse
 * binaire, pas JSON) et déclenche l'enregistrement dans le navigateur. */
export async function downloadFile(path: string, params: Record<string, string | undefined>, fallbackName: string) {
  const url = new URL(`${API_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }

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
  const filename = utf8Match ? decodeURIComponent(utf8Match[1]) : asciiMatch ? asciiMatch[1] : fallbackName;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

/** Le vrai fichier PDF du rapport (pas une impression de navigateur). */
export function downloadReportPdf(params: { activity?: number; period: Period; date?: string }) {
  return downloadFile(
    '/reports/pdf/',
    { activity: params.activity?.toString(), period: params.period, date: params.date },
    'rapport.pdf'
  );
}

/** Export pour le comptable : opérations + compte de résultat. */
export function downloadExport(params: { file: 'xlsx' | 'csv'; start: string; end: string; activity?: number }) {
  return downloadFile(
    '/reports/export/',
    { file: params.file, start: params.start, end: params.end, activity: params.activity?.toString() },
    `benef-export.${params.file}`
  );
}
