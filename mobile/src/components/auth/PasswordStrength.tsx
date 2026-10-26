import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize } from '@/theme';

const LEVELS = [
  { label: 'Trop faible', color: colors.negative },
  { label: 'Faible', color: colors.warning },
  { label: 'Correct', color: '#ca8a04' },
  { label: 'Solide', color: colors.positive },
  { label: 'Très solide', color: colors.positive },
];

/** 0 à 4 — indicatif, le serveur reste juge (8 caractères min., pas trop
 * courant, pas trop proche du nom d'utilisateur). Même règle que le web. */
export function passwordScore(password: string): number {
  if (password.length < 8) return 0;
  let score = 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  else if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 0.5;
  return Math.min(4, Math.floor(score));
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = passwordScore(password);
  const level = LEVELS[score];
  return (
    <View style={styles.wrap} accessibilityLabel={`Robustesse du mot de passe : ${level.label}`}>
      <View style={styles.bars}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.bar, i < Math.max(1, score) && { backgroundColor: level.color }]} />
        ))}
      </View>
      <Text style={styles.label}>
        Robustesse : <Text style={{ color: level.color, fontWeight: '700' }}>{level.label}</Text>
        {score < 2 ? ' · 12 caractères, majuscules, chiffres et symboles aident beaucoup' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: -4 },
  bars: { flexDirection: 'row', gap: 5 },
  bar: { flex: 1, height: 5, borderRadius: 999, backgroundColor: colors.placeholder },
  label: { fontSize: fontSize.xs, color: colors.textTertiary },
});
