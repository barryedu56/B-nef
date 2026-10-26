import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/theme';

const TONES = {
  error: { icon: 'alert-circle-outline', color: colors.negative, bg: colors.negativeSoft },
  info: { icon: 'mail-unread-outline', color: colors.accentDark, bg: colors.accentSoft },
  success: { icon: 'checkmark-circle-outline', color: colors.positive, bg: colors.positiveSoft },
} as const;

/** Encadré de message (erreur, information, succès). */
export function Alert({ message, tone = 'error' }: { message: string; tone?: keyof typeof TONES }) {
  const t = TONES[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg }]} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <Ionicons name={t.icon} size={18} color={t.color} />
      <Text style={[styles.text, { color: t.color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', borderRadius: radius.md, padding: spacing.md },
  text: { flex: 1, fontSize: fontSize.sm, lineHeight: 19 },
});
