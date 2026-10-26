import { onlineManager } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import { getOutboxSnapshot, loadOutbox, subscribeOutbox } from '@/offline/outbox';

export function useIsOnline() {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    // Rendu statique (expo web) : on suppose en ligne.
    () => true
  );
}

export function useOutbox() {
  useEffect(() => {
    void loadOutbox();
  }, []);
  const snapshot = useSyncExternalStore(subscribeOutbox, getOutboxSnapshot, getOutboxSnapshot);
  const pending = snapshot.ops.filter((op) => op.status === 'pending');
  const failed = snapshot.ops.filter((op) => op.status === 'failed');
  return { ...snapshot, pending, failed };
}
