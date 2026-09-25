import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { updateMe } from '@/api/auth';
import type { Period } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useAuth } from '@/context/AuthContext';
import { formatPeriodLabel, todayISO } from '@/lib/dates';
import { useFormatMoney } from '@/lib/money';
import { useGlobalSummary } from '@/hooks/useReports';
import { colors, fontSize, radius, spacing } from '@/theme';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
];

const CURRENCY_CHOICES = ['GNF', 'XOF', 'USD', 'EUR'];

export default function GlobalViewScreen() {
  const { user, refreshUser } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [displayCurrency, setDisplayCurrency] = useState(user?.effective_display_currency ?? 'GNF');
  const [switching, setSwitching] = useState(false);

  const anchor = todayISO();
  const summary = useGlobalSummary(period, displayCurrency, anchor);
  const formatMoney = useFormatMoney();

  const onPickCurrency = async (code: string) => {
    setDisplayCurrency(code);
    setSwitching(true);
    try {
      await updateMe({ display_currency: code });
      await refreshUser();
    } catch {
      // la bascule d'affichage reste appliquée localement même si la sauvegarde échoue
    } finally {
      setSwitching(false);
    }
  };

  if (summary.isLoading) return <LoadingView label="Calcul de la vue globale…" />;
  if (summary.isError || !summary.data) {
    return <ErrorView message="Impossible de charger la vue globale." onRetry={() => summary.refetch()} />;
  }

  const data = summary.data;
  const maxNet = Math.max(1, ...data.by_activity.map((row) => Math.abs(Number(row.net_profit))));
  const maxSeries = Math.max(1, ...data.timeseries.map((p) => Math.abs(Number(p.net_profit))));

  return (
    <Screen onRefresh={() => summary.refetch()} refreshing={summary.isRefetching}>
      <View style={styles.header}>
        <Text style={styles.title}>Vue globale</Text>
      </View>

      <View style={styles.content}>
        <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />

        <View style={styles.currencyRow}>
          {CURRENCY_CHOICES.map((code) => (
            <Chip key={code} label={code} selected={code === displayCurrency} onPress={() => onPickCurrency(code)} />
          ))}
          {switching ? <Text style={styles.switching}>…</Text> : null}
        </View>
        {!data.converted && data.display_currency !== data.source_currency ? (
          <Text style={styles.warning}>{data.conversion_error ?? 'Conversion indisponible pour le moment — montants en ' + data.source_currency + '.'}</Text>
        ) : null}

        <Card tone="muted" style={styles.heroCard}>
          <Text style={styles.heroLabel}>
            Revenu net total · {formatPeriodLabel(period, anchor)}
          </Text>
          <AmountText amount={data.net_profit} currency={data.currency} size={28} />
        </Card>

        <Card style={styles.patrimoineCard}>
          <Text style={styles.cardTitle}>Patrimoine</Text>
          <Row label="Argent en caisse" amount={data.cash_balance} currency={data.currency} formatMoney={formatMoney} />
          <Row label="Valeur du stock" amount={data.stock_value} currency={data.currency} formatMoney={formatMoney} />
          <Row label="On me doit (créances)" amount={data.receivable} currency={data.currency} formatMoney={formatMoney} tone="positive" />
          <Row label="Je dois (dettes)" amount={data.payable} currency={data.currency} formatMoney={formatMoney} tone="negative" negate />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <AmountText amount={data.patrimoine} currency={data.currency} size={16} sign="neutral" />
          </View>
        </Card>

        {data.by_activity.length > 0 ? (
          <Card style={styles.breakdownCard}>
            <Text style={styles.cardTitle}>Résultat par activité</Text>
            <View style={{ gap: spacing.md }}>
              {data.by_activity.map((row) => (
                <View key={row.activity_id} style={{ gap: 4 }}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownName} numberOfLines={1}>
                      {row.name}
                    </Text>
                    <AmountText amount={row.net_profit} currency={row.currency} size={12.5} />
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.min(100, (Math.abs(Number(row.net_profit)) / maxNet) * 100)}%`,
                          backgroundColor: Number(row.net_profit) < 0 ? colors.negative : colors.accent,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {data.timeseries.length > 0 ? (
          <Card style={styles.breakdownCard}>
            <Text style={styles.cardTitle}>Revenu net — {data.timeseries.length} derniers mois</Text>
            <View style={styles.chart}>
              {data.timeseries.map((point) => (
                <View
                  key={point.month}
                  style={[
                    styles.chartBar,
                    {
                      height: Math.max(6, (Math.abs(Number(point.net_profit)) / maxSeries) * 96),
                      backgroundColor: Number(point.net_profit) < 0 ? colors.negative : '#cdcdc8',
                    },
                  ]}
                />
              ))}
            </View>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

function Row({
  label,
  amount,
  currency,
  formatMoney,
  tone,
  negate,
}: {
  label: string;
  amount: string;
  currency: string;
  formatMoney: (amount: string | number, code: string) => string;
  tone?: 'positive' | 'negative';
  negate?: boolean;
}) {
  const n = Number(amount) * (negate ? -1 : 1);
  const color = tone === 'positive' ? colors.positive : tone === 'negative' ? colors.negative : colors.textPrimary;
  const text = formatMoney(Math.abs(n), currency);
  const prefixed = tone === 'positive' ? `+${text}` : tone === 'negative' ? `−${text}` : text;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color }]}>{prefixed}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  currencyRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  switching: { color: colors.textTertiary },
  warning: { fontSize: fontSize.xs, color: colors.warning },
  heroCard: { gap: 4 },
  heroLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  cardTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  patrimoineCard: { gap: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  rowValue: { fontSize: fontSize.sm, fontVariant: ['tabular-nums'] },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  totalLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  breakdownCard: {},
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  breakdownName: { fontSize: fontSize.sm, color: colors.textPrimary, flexShrink: 1 },
  barTrack: { height: 7, backgroundColor: '#f0f0ee', borderRadius: radius.pill },
  barFill: { height: 7, borderRadius: radius.pill },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 96, backgroundColor: colors.bg, borderRadius: radius.sm, padding: 10 },
  chartBar: { flex: 1, borderRadius: 3 },
});
