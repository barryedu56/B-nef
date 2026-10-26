import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AmountText } from '@/components/ui/AmountText';
import { Card } from '@/components/ui/Card';
import { colors, fontSize, radius, spacing } from '@/theme';

export type KpiTone = 'accent' | 'positive' | 'negative' | 'warning' | 'info';

const TONES: Record<KpiTone, { fg: string; bg: string }> = {
  accent: { fg: colors.accent, bg: colors.accentSoft },
  positive: { fg: colors.positive, bg: colors.positiveSoft },
  negative: { fg: colors.negative, bg: colors.negativeSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
};

/** Indicateur avec icône colorée (moitié de largeur dans une grille). */
export function KpiTile({
  label,
  amount,
  currency,
  icon,
  tone = 'accent',
}: {
  label: string;
  amount: string;
  currency: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  tone?: KpiTone;
}) {
  const t = TONES[tone];
  return (
    <Card style={styles.tile} padding={spacing.md + 2}>
      <View style={[styles.icon, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={17} color={t.fg} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <AmountText amount={amount} currency={currency} size={16} weight="700" sign="neutral" />
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: '46%', gap: 6 },
  icon: { width: 32, height: 32, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '600' },
});
