import { Alert, Platform } from 'react-native';

/** Dans la version téléphone servie par le navigateur (PWA), react-native-web
 * ne fait rien sur Alert.alert : les confirmations (archiver, supprimer…)
 * étaient muettes et l'action ne partait jamais. On les remplace par les
 * fenêtres du navigateur : une question par action possible. */
export function installWebAlert() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  Alert.alert = (title, message, buttons) => {
    const text: string = message ? `${title}\n\n${message}` : String(title ?? '');
    const cancel = buttons?.find((b) => b.style === 'cancel');
    const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
    if (actions.length === 0) {
      window.alert(text);
      cancel?.onPress?.();
      return;
    }
    if (actions.length === 1) {
      if (window.confirm(text)) actions[0].onPress?.();
      else cancel?.onPress?.();
      return;
    }
    for (const action of actions) {
      if (window.confirm(`${text}\n\n${action.text} ?`)) {
        action.onPress?.();
        return;
      }
    }
    cancel?.onPress?.();
  };
}
