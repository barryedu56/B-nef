import { ApiError } from '@/api/client';

/** Erreurs de l'API rangées par champ ({ username: "…", email: "…" }) pour
 * les afficher sous chaque champ ; `detail` (ou un champ inconnu) va dans
 * `general`. */
export function fieldErrors<K extends string>(error: unknown, fields: readonly K[]): Partial<Record<K | 'general', string>> {
  const out: Partial<Record<K | 'general', string>> = {};
  if (!(error instanceof ApiError)) {
    out.general = 'Une erreur est survenue. Réessaie.';
    return out;
  }
  const body = error.body as Record<string, unknown> | null;
  if (body && typeof body === 'object') {
    for (const [key, value] of Object.entries(body)) {
      const message = Array.isArray(value) ? String(value[0]) : typeof value === 'string' ? value : null;
      if (!message) continue;
      if ((fields as readonly string[]).includes(key)) out[key as K] = message;
      else out.general ??= message;
    }
  }
  if (!Object.keys(out).length) out.general = error.message;
  return out;
}
