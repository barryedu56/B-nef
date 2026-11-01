/** Retrouver hors connexion des données déjà gardées sur le téléphone, même
 * si l'écran exact n'a jamais été ouvert en ligne.
 *
 * Les clés sont comparées en JSON : dans le cache restauré, un `undefined`
 * de la clé est devenu `null`, et la comparaison de React Query ne les
 * confond pas. */
import type { QueryClient, QueryKey } from '@tanstack/react-query';

function keyStartsWith(key: QueryKey, prefix: QueryKey): boolean {
  return key.length >= prefix.length && JSON.stringify(key.slice(0, prefix.length)) === JSON.stringify(prefix);
}

function rowsOf(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  const results = (data as { results?: unknown } | null)?.results;
  return Array.isArray(results) ? results : null;
}

/** Un élément (opération, produit, tiers…) trouvé dans une des listes déjà
 * en cache sous `prefix` (ex. ['transactions']). */
export function findCachedItem<T extends { id: number }>(
  queryClient: QueryClient,
  prefix: QueryKey,
  id: number | undefined
): T | undefined {
  if (id === undefined) return undefined;
  for (const query of queryClient.getQueryCache().getAll()) {
    if (!keyStartsWith(query.queryKey, prefix)) continue;
    const hit = rowsOf(query.state.data)?.find((row) => (row as { id?: number } | null)?.id === id);
    if (hit) return hit as T;
  }
  return undefined;
}

/** Les données les plus récentes gardées sous `prefix`, quelle que soit la
 * suite de la clé (ex. le résumé du mois, calculé un autre jour). `rest`
 * filtre la suite de la clé si besoin. */
export function latestCached<T>(
  queryClient: QueryClient,
  prefix: QueryKey,
  rest?: (key: QueryKey) => boolean
): T | undefined {
  let best: { at: number; data: T } | undefined;
  for (const query of queryClient.getQueryCache().getAll()) {
    if (query.state.data === undefined || !keyStartsWith(query.queryKey, prefix)) continue;
    if (rest && !rest(query.queryKey.slice(prefix.length))) continue;
    if (!best || query.state.dataUpdatedAt > best.at) best = { at: query.state.dataUpdatedAt, data: query.state.data as T };
  }
  return best?.data;
}
