import { StyleSheet, Text, View } from 'react-native';

import type { BudgetStatus } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { colors, fontSize } from '@/theme';

const PERIOD_LABEL: Record<BudgetStatus['period'], string> = { week: 'semaine', month: 'mois', year: 'année' };

const COLOR: Record<BudgetStatus['status'], string> = {
  ok: colors.positive,
  warning: colors.warning,
  over: colors.negative,
};

export function budgetTitle(b: BudgetStatus) {
  const target = b.category_name ?? 'Toutes les dépenses';
  return b.activity_name ? `${target} · ${b.activity_name}` : `${target} · toutes activités`;
}

/** Une ligne « dépensé / prévu » avec sa barre de progression. */
export function BudgetProgress({ budget }: { budget: BudgetStatus }) {
  const pct = Math.min(100, Math.round(Number(budget.ratio) * 100));
  const remaining = Number(budget.remaining);
  return (
    <View style={styles.wrap} accessibilityLabel={`${budgetTitle(budget)} : ${pct} % utilisé`}>
      <Text style={styles.title} numberOfLines={2}>
        {budgetTitle(budget)}
        <Text style={styles.period}> · par {PERIOD_LABEL[budget.period]}</Text>
      </Text>
      <View style={styles.amounts}>
        <AmountText amount={budget.spent} currency={budget.currency} size={12.5} sign="neutral" />
        <Text style={styles.period}> / </Text>
        <AmountText amount={budget.planned} currency={budget.currency} size={12.5} sign="neutral" />
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: COLOR[budget.status] }]} />
      </View>
      <View style={styles.amounts}>
        {budget.status === 'over' ? (
          <>
            <Text style={[styles.hint, { color: COLOR.over }]}>Dépassé de </Text>
            <AmountText amount={-remaining} currency={budget.currency} size={11.5} sign="negative" />
          </>
        ) : (
          <>
            <Text style={[styles.hint, budget.status === 'warning' && { color: COLOR.warning }]}>Reste </Text>
            <AmountText amount={remaining} currency={budget.currency} size={11.5} sign="neutral" />
            <Text style={[styles.hint, budget.status === 'warning' && { color: COLOR.warning }]}>
              {' '}· {Math.round(Number(budget.ratio) * 100)} % utilisé
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, paddingVertical: 6 },
  title: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  period: { fontSize: fontSize.xs, fontWeight: '400', color: colors.textTertiary },
  amounts: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  track: { height: 6, borderRadius: 999, backgroundColor: colors.placeholder, overflow: 'hidden' },
  fill: { height: '100%' },
  hint: { fontSize: 11.5, color: colors.textTertiary },
});
