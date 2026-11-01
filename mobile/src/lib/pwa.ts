/** Version installable (PWA) : sur iPhone (pas d'App Store pour l'instant),
 * l'app s'installe depuis Safari et s'ouvre ensuite comme une vraie app. */
import { Platform } from 'react-native';

/** Enregistre le service worker (ouverture sans réseau). Seulement dans le
 * navigateur, en production (servie sous EXPO_BASE_URL, ex. /app). */
export function registerServiceWorker() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const base = process.env.EXPO_BASE_URL ?? '';
  if (!base) return; // développement : pas de cache qui masquerait les changements
  navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {});
}

/** Ouverte dans Safari sur iPhone / iPad, et pas encore installée. */
export function shouldSuggestIosInstall(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}
