/** Version installable (PWA) : sur iPhone et Android (en attendant les
 * stores), l'app s'installe depuis le navigateur et s'ouvre ensuite comme
 * une vraie app. */
import { Platform } from 'react-native';

/** Demande d'installation proposée par Chrome sur Android (événement
 * « beforeinstallprompt »), gardée pour l'afficher au bon moment. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // on affiche notre propre bouton « Installer »
    installPrompt = event as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    listeners.forEach((l) => l());
  });
}

export function canPromptInstall(): boolean {
  return installPrompt !== null;
}

export function onInstallAvailabilityChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Ouvre la fenêtre d'installation de Chrome. Vrai si l'utilisateur accepte. */
export async function promptInstall(): Promise<boolean> {
  if (!installPrompt) return false;
  const event = installPrompt;
  installPrompt = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  listeners.forEach((l) => l());
  return outcome === 'accepted';
}

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
