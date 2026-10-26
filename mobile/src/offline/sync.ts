/** Envoi au serveur des opérations en attente, dans l'ordre de saisie. */
import { onlineManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { ApiError, apiRequest } from '@/api/client';
import {
  creatorOf,
  getOutboxSnapshot,
  hasPendingOps,
  loadOutbox,
  recordCreatedId,
  removeOp,
  resolveIds,
  setSyncing,
  unresolvedTempIds,
  updateOp,
} from './outbox';
import { warmOfflineCache } from './prefetch';
import { queryClient } from './queryClient';

let running: Promise<void> | null = null;

export function syncOutbox(): Promise<void> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

/** Erreur définitive (le serveur a refusé l'opération telle quelle) — par
 * opposition au réseau coupé, au serveur en panne ou à la session expirée,
 * où il suffit de réessayer plus tard. */
function isRejected(error: unknown) {
  return (
    error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429
  );
}

async function run() {
  await loadOutbox();
  if (!onlineManager.isOnline() || !hasPendingOps()) return;
  setSyncing(true);
  let synced = 0;
  try {
    for (const queued of getOutboxSnapshot().ops) {
      if (queued.status !== 'pending') continue;
      const op = resolveIds(queued);
      const missing = unresolvedTempIds(op);
      if (missing.length > 0) {
        const creator = creatorOf(missing[0]);
        await updateOp(op.id, {
          status: 'failed',
          error: creator
            ? `Dépend de « ${creator.label} », qui n'a pas pu être enregistré.`
            : 'Dépend d’un élément qui n’a pas pu être enregistré.',
        });
        continue;
      }
      try {
        const result = await apiRequest<{ id?: number } | undefined>(op.path, {
          method: op.method,
          body: op.body,
          headers: { 'Idempotency-Key': op.id },
        });
        if (op.tempId !== undefined && typeof result?.id === 'number') {
          await recordCreatedId(op.tempId, result.id);
        }
        await removeOp(op.id);
        synced += 1;
      } catch (error) {
        if (isRejected(error)) {
          await updateOp(op.id, { status: 'failed', error: (error as ApiError).message });
          continue;
        }
        break; // on réessaiera au prochain retour du réseau
      }
    }
  } finally {
    setSyncing(false);
    if (synced > 0) await queryClient.invalidateQueries();
  }
}

/** À appeler une fois au démarrage : synchronise dès que le réseau revient,
 * quand l'app repasse au premier plan, et toutes les minutes en secours. */
export function startOutboxSync() {
  // Envoie d'abord ce qui attend, puis recharge les données de travail.
  const refresh = () => void syncOutbox().then(() => warmOfflineCache());
  const unsubscribeOnline = onlineManager.subscribe((online) => {
    if (online) refresh();
  });
  const appState = AppState.addEventListener('change', (next) => {
    if (next === 'active') refresh();
  });
  const timer = setInterval(() => void syncOutbox(), 60_000);
  void syncOutbox();
  return () => {
    unsubscribeOnline();
    appState.remove();
    clearInterval(timer);
  };
}
