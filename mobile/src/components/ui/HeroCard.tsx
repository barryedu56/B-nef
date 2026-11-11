import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AmountText } from '@/components/ui/AmountText';
import { colors, fontSize, radius, shadow, spacing } from '@/theme';

/** Grande carte blanche du chiffre clé (bénéfice net) : le montant en très
 * gros, une pastille « Tu gagnes / Tu perds », et des mini-stats colorées
 * en dessous (vert = argent qui entre, rouge = argent qui sort). */
export function HeroCard({
  label,
  amount,
  currency,
  children,
}: {
  label: string;
  amount: string;
  currency: string;
  children?: ReactNode;
}) {
  const value = Number(amount);
  const badge = value > 0 ? { text: 'Tu gagnes', bg: colors.positiveSoft, fg: colors.positive } : value < 0 ? { text: 'Tu perds', bg: colors.negativeSoft, fg: colors.negative } : null;
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.label}>{label}</Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.text}</Text>
          </View>
        ) : null}
      </View>
      <AmountText amount={amount} currency={currency} size={34} weight="900" sign="neutral" style={styles.amount} />
      {children ? <View style={styles.stats}>{children}</View> : null}
    </View>
  );
}

const TONES = {
  in: { bg: colors.positiveSoft, fg: colors.positive, icon: 'arrow-down' as const },
  out: { bg: colors.negativeSoft, fg: colors.negative, icon: 'arrow-up' as const },
  neutral: { bg: colors.placeholder, fg: colors.textSecondary, icon: null },
};

/** Mini-stat à placer dans une HeroCard. `tone` : in (vert), out (rouge). */
export function HeroStat({
  label,
  amount,
  currency,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  amount: string;
  currency: string;
  onPress?: () => void;
  tone?: keyof typeof TONES;
}) {
  const t = TONES[tone];
  const content = (
    <>
      {t.icon ? <Ionicons name={t.icon} size={20} color={t.fg} /> : null}
      <View style={styles.statText}>
        <Text style={[styles.statLabel, { color: t.fg }]} numberOfLines={1}>
          {label}
          {onPress ? ' ›' : ''}
        </Text>
        <AmountText amount={amount} currency={currency} size={14.5} weight="800" sign="neutral" style={styles.amount} />
      </View>
    </>
  );
  const style = [styles.stat, { backgroundColor: t.bg }];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.8 }]} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadow.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '800' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: fontSize.sm, fontWeight: '800' },
  amount: { color: colors.textPrimary },
  stats: { flexDirection: 'row', gap: spacing.sm + 2, marginTop: spacing.xs },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg - 4, paddingVertical: 10, paddingHorizontal: spacing.md },
  statText: { flex: 1, gap: 1 },
  statLabel: { fontSize: 12, fontWeight: '800' },
});
