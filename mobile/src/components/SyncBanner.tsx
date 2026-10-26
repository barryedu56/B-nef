import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useIsOnline, useOutbox } from '@/hooks/useOffline';
import { colors, fontSize, spacing } from '@/theme';

function plural(n: number, word: string) {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

/** Bandeau d'état du mode hors-ligne : rien quand tout est en ligne et
 * synchronisé. Touche pour voir le détail (écran Synchronisation). */
export function SyncBanner() {
  const online = useIsOnline();
  const { pending, failed, syncing } = useOutbox();

  let tone: 'muted' | 'warning' | 'danger' = 'muted';
  let icon: keyof typeof Ionicons.glyphMap = 'cloud-offline-outline';
  let text: string;

  if (failed.length > 0) {
    tone = 'danger';
    icon = 'alert-circle-outline';
    text = `${plural(failed.length, 'opération')} non ${failed.length > 1 ? 'enregistrées' : 'enregistrée'} — à vérifier`;
  } else if (!online) {
    tone = 'warning';
    text =
      pending.length > 0
        ? `Hors ligne · ${plural(pending.length, 'opération')} en attente d'envoi`
        : 'Hors ligne · tu peux continuer à saisir, tout partira au retour du réseau';
  } else if (pending.length > 0) {
    icon = 'sync-outline';
    text = syncing
      ? `Synchronisation de ${plural(pending.length, 'opération')}…`
      : `${plural(pending.length, 'opération')} en attente d'envoi`;
  } else {
    return null;
  }

  return (
    <Pressable
      onPress={() => router.push('/sync')}
      style={[styles.banner, styles[tone]]}
      accessibilityRole="button"
      accessibilityLabel={`${text}. Voir le détail`}>
      <Ionicons name={icon} size={15} color={textColor[tone]} />
      <Text style={[styles.text, { color: textColor[tone] }]} numberOfLines={2}>
        {text}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={textColor[tone]} />
    </Pressable>
  );
}

const textColor = { muted: colors.textSecondary, warning: colors.warning, danger: colors.negative };

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  text: { flex: 1, fontSize: fontSize.xs, fontWeight: '600' },
  muted: { backgroundColor: colors.accentSoft },
  warning: { backgroundColor: '#fef3c7' },
  danger: { backgroundColor: '#fee2e2' },
});
