import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CashFlowBlock, Period } from '@/api/types';
import { AccountIcon } from '@/components/AccountIcon';
import { AmountText } from '@/components/ui/AmountText';
import { Card } from '@/components/ui/Card';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TopBar } from '@/components/ui/TopBar';
import { useCashFlow } from '@/hooks/useAccounts';
import { useActivities } from '@/hooks/useActivities';
import { useMoneyActivity } from '@/lib/moneyFilter';
import { formatPeriodLabel, shiftAnchor, todayISO } from '@/lib/dates';
import { colors, fontSize, spacing } from '@/theme';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
];

/** D'où vient l'argent et où il est parti, sur une période. */
export default function CashFlowScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [anchor, setAnchor] = useState(todayISO());
  const filter = useMoneyActivity();
  const flow = useCashFlow(period, anchor, filter);
  const activities = useActivities();
  const filterName = (activities.data ?? []).find((a) => a.id === filter)?.name;

  return (
    <Screen edges={['top']} onRefresh={() => flow.refetch()} refreshing={flow.isRefetching}>
      <TopBar title="Entrées et sorties" subtitle={filterName} back />
      <View style={styles.content}>
        <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        <View style={styles.periodNav}>
          <Pressable hitSlop={10} onPress={() => setAnchor((a) => shiftAnchor(period, a, -1))} accessibilityLabel="Période précédente">
            <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.periodLabel}>{formatPeriodLabel(period, anchor)}</Text>
          <Pressable hitSlop={10} onPress={() => setAnchor((a) => shiftAnchor(period, a, 1))} accessibilityLabel="Période suivante">
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        {flow.isLoading ? (
          <LoadingView />
        ) : flow.isError || !flow.data ? (
          <ErrorView message="Impossible de calculer les mouvements." onRetry={() => flow.refetch()} />
        ) : (
          <>
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Toutes tes caisses</Text>
              <FlowBlock block={flow.data.totals} currency={flow.data.currency} labels={flow.data.labels} />
              <Text style={styles.note}>
                Un transfert entre deux de tes caisses apparaît à la fois en entrée et en sortie : il ne change pas ton total.
              </Text>
            </Card>

            <Text style={styles.sectionTitle}>Par caisse</Text>
            {flow.data.accounts.map((acc) => (
              <Card key={acc.id} style={styles.accountCard}>
                <View style={styles.accountHead}>
                  <AccountIcon account={acc} size={36} />
                  <Text style={styles.accountName}>{acc.name}</Text>
                </View>
                <View style={styles.accountRow}>
                  <Mini label="Au début" amount={acc.opening} currency={acc.currency} />
                  <Mini label="Entré" amount={acc.total_in} currency={acc.currency} color={colors.positive} prefix="+" />
                  <Mini label="Sorti" amount={acc.total_out} currency={acc.currency} color={colors.negative} prefix="−" />
                  <Mini label="À la fin" amount={acc.closing} currency={acc.currency} strong />
                </View>
              </Card>
            ))}
          </>
        )}
      </View>
    </Screen>
  );
}

function FlowBlock({
  block,
  currency,
  labels,
}: {
  block: CashFlowBlock;
  currency: string;
  labels: { in: Record<string, string>; out: Record<string, string> };
}) {
  const ins = Object.entries(block.in).filter(([, v]) => Number(v) !== 0);
  const outs = Object.entries(block.out).filter(([, v]) => Number(v) !== 0);
  return (
    <View style={{ gap: spacing.sm }}>
      <Row label="Au début de la période" amount={block.opening} currency={currency} strong />
      <Text style={[styles.side, { color: colors.positive }]}>Entrées</Text>
      {ins.length === 0 ? <Text style={styles.empty}>Aucune entrée</Text> : null}
      {ins.map(([k, v]) => (
        <Row key={k} label={labels.in[k] ?? k} amount={v} currency={currency} sign="+" />
      ))}
      <Text style={[styles.side, { color: colors.negative }]}>Sorties</Text>
      {outs.length === 0 ? <Text style={styles.empty}>Aucune sortie</Text> : null}
      {outs.map(([k, v]) => (
        <Row key={k} label={labels.out[k] ?? k} amount={v} currency={currency} sign="−" />
      ))}
      <View style={styles.divider} />
      <Row label="À la fin de la période" amount={block.closing} currency={currency} strong />
    </View>
  );
}

function Row({ label, amount, currency, strong, sign }: { label: string; amount: string; currency: string; strong?: boolean; sign?: '+' | '−' }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.strong]} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.amountRow}>
        {sign ? <Text style={[styles.sign, { color: sign === '+' ? colors.positive : colors.negative }]}>{sign}</Text> : null}
        <AmountText amount={amount} currency={currency} size={strong ? 15 : 13.5} weight={strong ? '800' : '600'} sign="neutral" />
      </View>
    </View>
  );
}

function Mini({ label, amount, currency, color, prefix, strong }: { label: string; amount: string; currency: string; color?: string; prefix?: string; strong?: boolean }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniValue, color ? { color } : null, strong && { fontWeight: '800' }]} numberOfLines={1} adjustsFontSizeToFit>
        {prefix && Number(amount) !== 0 ? prefix : ''}
        {Number(amount).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
      </Text>
      <Text style={styles.miniLabel}>{currency}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  periodNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  periodLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  card: { gap: spacing.md },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  side: { fontSize: fontSize.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.xs },
  empty: { fontSize: fontSize.xs, color: colors.textTertiary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  rowLabel: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary },
  strong: { fontWeight: '700', color: colors.textPrimary },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sign: { fontSize: fontSize.md, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  note: { fontSize: fontSize.xs, color: colors.textTertiary, lineHeight: 16 },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.sm },
  accountCard: { gap: spacing.md },
  accountHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  accountName: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  accountRow: { flexDirection: 'row', gap: spacing.xs },
  mini: { flex: 1, alignItems: 'center', gap: 1 },
  miniLabel: { fontSize: 10.5, color: colors.textTertiary },
  miniValue: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary },
});
