/** Activité choisie dans « Mon argent » (null = toutes), partagée par les
 * écrans d'argent et retenue d'une ouverture à l'autre. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'benef.money.activity';
let current: number | null = null;
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v && current === null) setMoneyActivity(Number(v));
  })
  .catch(() => {});

export function setMoneyActivity(activityId: number | null) {
  current = activityId;
  listeners.forEach((l) => l());
  (activityId === null ? AsyncStorage.removeItem(KEY) : AsyncStorage.setItem(KEY, String(activityId))).catch(() => {});
}

export function useMoneyActivity(): number | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
