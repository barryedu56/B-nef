import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AmountText } from '@/components/ui/AmountText';
import { colors, fontSize, radius, shadow, spacing } from '@/theme';

/** Grande carte indigo du chiffre clé (bénéfice net), avec des mini-stats
 * optionnelles en dessous. */
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
  const negative = Number(amount) < 0;
  return (
    <View style={styles.card}>
      <View style={[styles.bubble, styles.bubbleA]} />
      <View style={[styles.bubble, styles.bubbleB]} />
      <Text style={styles.label}>{label}</Text>
      <AmountText amount={amount} currency={currency} size={30} weight="800" sign="neutral" style={styles.amount} />
      {negative ? <Text style={styles.note}>Perte sur la période</Text> : null}
      {children ? <View style={styles.stats}>{children}</View> : null}
    </View>
  );
}

/** Mini-stat blanche à placer dans une HeroCard. */
export function HeroStat({ label, amount, currency }: { label: string; amount: string; currency: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <AmountText amount={amount} currency={currency} size={14} weight="700" sign="neutral" style={styles.statAmount} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: 4,
    overflow: 'hidden',
    ...shadow.accent,
  },
  bubble: { position: 'absolute', borderRadius: 999 },
  bubbleA: { width: 180, height: 180, right: -50, top: -70, backgroundColor: 'rgba(255,255,255,0.1)' },
  bubbleB: { width: 120, height: 120, right: 60, bottom: -80, backgroundColor: 'rgba(109,40,217,0.55)' },
  label: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.82)', fontWeight: '600' },
  amount: { color: colors.white },
  note: { fontSize: fontSize.xs, color: '#fecaca', fontWeight: '600' },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.md, padding: spacing.md, gap: 2 },
  statLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.8)' },
  statAmount: { color: colors.white },
});
