/** Rappels sur le téléphone le jour d'une dépense fixe (loyer, salaire…) :
 * notifications locales, programmées sur l'appareil — elles arrivent même
 * sans internet. Pas de notifications dans le navigateur : la bannière
 * « À confirmer » de l'accueil suffit. */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import type { RecurringOperation } from '@/api/recurring';
import { formatAmount } from '@/lib/money';

const PREFIX = 'benef-recurring-';
const CHANNEL = 'reminders';
const HOUR = 8; // rappel à 8 h le jour de l'échéance

let configured = false;

/** À appeler une fois au démarrage : affichage des rappels même app ouverte,
 * et un appui sur le rappel ouvre l'écran des dépenses fixes. */
export function setupReminders(): () => void {
  if (Platform.OS === 'web') return () => {};
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    if (String(response.notification.request.identifier).startsWith(PREFIX)) router.push('/recurring');
  });
  return () => sub.remove();
}

async function ensurePermission(): Promise<boolean> {
  if (!configured && Platform.OS === 'android') {
    // Android 13+ : la demande d'autorisation n'apparaît qu'une fois un canal créé.
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Rappels de dépenses fixes',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    configured = true;
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Reprogramme un rappel par dépense fixe active, à sa prochaine échéance. */
export async function syncReminders(items: RecurringOperation[]): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
    const upcoming = items.filter((r) => r.is_active);
    if (upcoming.length === 0 || !(await ensurePermission())) return;
    const now = Date.now();
    for (const r of upcoming) {
      const [y, m, d] = r.next_due.split('-').map(Number);
      const when = new Date(y, m - 1, d, HOUR, 0, 0);
      if (when.getTime() <= now) continue; // déjà arrivée : la bannière de l'accueil s'en charge
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${r.id}`,
        content: {
          title: `${r.direction === 'out' ? 'Dépense' : 'Entrée'} fixe à confirmer`,
          body: `${r.label} · ${formatAmount(r.amount, r.currency)} — touche pour confirmer ou passer.`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
      });
    }
  } catch {
    // Rappels indisponibles (ex. autorisation refusée) : la bannière reste.
  }
}
