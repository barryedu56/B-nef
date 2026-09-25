import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Period, Transaction } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TopBar } from '@/components/ui/TopBar';
import { useActivity } from '@/hooks/useActivities';
import { useActivitySummary } from '@/hooks/useReports';
import { useCategories, usePaymentMethods, useTransactions } from '@/hooks/useTransactions';
import { formatPeriodLabel, formatRelativeDate, shiftAnchor, todayISO } from '@/lib/dates';
import { colors, fontSize, radius, spacing } from '@/theme';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
];

export default function ActivityDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activityId = Number(id);

  const [period, setPeriod] = useState<Period>('month');
  const [anchor, setAnchor] = useState(todayISO());

  const activity = useActivity(activityId);
  const summary = useActivitySummary(activityId, period, undefined, anchor);
  const transactions = useTransactions(activityId, 6);
  const categories = useCategories(activityId);
  const paymentMethods = usePaymentMethods();

  if (activity.isLoading || summary.isLoading) return <LoadingView label="Chargement du tableau de bord…" />;
  if (activity.isError || !activity.data) {
    return <ErrorView message="Activité introuvable." onRetry={() => activity.refetch()} />;
  }
  if (summary.isError || !summary.data) {
    return <ErrorView message="Impossible de calculer le résumé." onRetry={() => summary.refetch()} />;
  }

  const act = activity.data;
  const data = summary.data;
  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  const paymentById = new Map((paymentMethods.data ?? []).map((p) => [p.id, p.name]));
  const maxSeries = Math.max(1, ...data.timeseries.map((p) => Math.abs(Number(p.net_profit))));

  return (
    <Screen edges={['top']} onRefresh={() => { activity.refetch(); summary.refetch(); transactions.refetch(); }} refreshing={summary.isRefetching}>
      <TopBar
        title={act.name}
        back
        right={
          <Pressable
            hitSlop={10}
            onPress={() => router.push({ pathname: '/activity/[id]/settings', params: { id } })}
            style={styles.iconButton}>
            <Ionicons name="options-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        }
      />

      <View style={styles.content}>
        <View style={styles.periodBlock}>
          <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
          <View style={styles.periodNav}>
            <Pressable hitSlop={10} onPress={() => setAnchor((a) => shiftAnchor(period, a, -1))}>
              <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
            </Pressable>
            <Text style={styles.periodLabel}>{formatPeriodLabel(period, anchor)}</Text>
            <Pressable hitSlop={10} onPress={() => setAnchor((a) => shiftAnchor(period, a, 1))}>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <Card tone="muted" style={styles.heroCard}>
          <Text style={styles.heroLabel}>Bénéfice net de la période</Text>
          <AmountText amount={data.net_profit} currency={data.currency} size={26} />
        </Card>

        <View style={styles.kpiGrid}>
          <KpiTile label="Chiffre d'affaires" amount={data.revenue} currency={data.currency} sign="neutral" />
          {act.has_inventory ? <KpiTile label="Coût des ventes" amount={data.cogs} currency={data.currency} sign="negative" /> : null}
          {act.has_inventory ? <KpiTile label="Marge brute" amount={data.gross_margin} currency={data.currency} sign="neutral" /> : null}
          <KpiTile label="Charges" amount={data.expenses} currency={data.currency} sign="negative" />
          {act.has_inventory ? (
            <KpiTile label="Consommé personnellement" amount={data.personal_use} currency={data.currency} sign="neutral" />
          ) : null}
        </View>

        <View style={styles.kpiGrid}>
          {act.has_inventory ? <KpiTile label="Valeur du stock" amount={data.stock_value} currency={data.currency} sign="neutral" /> : null}
          <KpiTile label="Caisse" amount={data.cash_balance} currency={data.currency} sign="neutral" />
        </View>

        {data.timeseries.length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>Évolution du bénéfice</Text>
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

        <View style={styles.actionsRow}>
          {act.has_inventory ? (
            <ActionButton
              label="+ Vente"
              primary
              onPress={() => router.push({ pathname: '/activity/[id]/new-sale', params: { id } })}
            />
          ) : null}
          <ActionButton
            label="+ Opération"
            primary={!act.has_inventory}
            onPress={() => router.push({ pathname: '/activity/[id]/new-transaction', params: { id } })}
          />
          {act.has_inventory ? (
            <ActionButton
              label="+ Réappro"
              onPress={() => router.push({ pathname: '/activity/[id]/products', params: { id } })}
            />
          ) : null}
        </View>

        <View>
          <View style={styles.listHeader}>
            <Text style={styles.cardTitle}>Dernières opérations</Text>
          </View>
          {transactions.data && transactions.data.results.length > 0 ? (
            <View>
              {transactions.data.results.map((txn) => (
                <TransactionRow
                  key={txn.id}
                  txn={txn}
                  currency={act.currency}
                  categoryName={txn.category ? categoryById.get(txn.category) : undefined}
                  paymentName={txn.payment_method ? paymentById.get(txn.payment_method) : undefined}
                />
              ))}
            </View>
          ) : (
            <EmptyState icon="receipt-outline" title="Aucune opération enregistrée" />
          )}
        </View>
      </View>
    </Screen>
  );
}

function KpiTile({ label, amount, currency, sign }: { label: string; amount: string; currency: string; sign: 'neutral' | 'negative' }) {
  return (
    <Card style={styles.kpiTile}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <AmountText amount={amount} currency={currency} size={16} sign={sign === 'negative' && Number(amount) > 0 ? 'negative' : 'neutral'} />
    </Card>
  );
}

function ActionButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, primary && styles.actionButtonPrimary]}>
      <Text style={[styles.actionButtonLabel, primary && styles.actionButtonLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

function TransactionRow({
  txn,
  currency,
  categoryName,
  paymentName,
}: {
  txn: Transaction;
  currency: string;
  categoryName?: string;
  paymentName?: string;
}) {
  const label = kindLabel(txn, categoryName);
  const meta = [
    formatRelativeDate(txn.occurred_on),
    paymentName,
    txn.is_voided ? 'annulée' : txn.is_credit && !txn.is_settled ? 'à crédit' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      style={styles.txnRow}
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: String(txn.id) } })}>
      <View style={styles.txnInfo}>
        <Text style={[styles.txnLabel, txn.is_voided && styles.txnLabelVoided]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.txnMeta}>{meta}</Text>
      </View>
      {txn.is_voided ? (
        <Ionicons name="close-circle-outline" size={16} color={colors.textTertiary} />
      ) : (
        <AmountText amount={txn.amount_activity} currency={currency} size={13.5} sign={txn.direction === 'in' ? 'positive' : 'negative'} />
      )}
    </Pressable>
  );
}

function kindLabel(txn: Transaction, categoryName?: string) {
  switch (txn.kind) {
    case 'sale':
      return 'Vente';
    case 'purchase':
      return 'Réapprovisionnement';
    case 'settlement':
      return 'Règlement';
    case 'adjustment':
      return 'Ajustement de stock';
    case 'opening_balance':
      return 'Solde initial';
    case 'personal_use':
      return 'Consommation personnelle';
    default:
      return categoryName ?? (txn.direction === 'in' ? 'Entrée' : 'Sortie');
  }
}

const styles = StyleSheet.create({
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, gap: spacing.md },
  periodBlock: { gap: spacing.sm },
  periodNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  periodLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  heroCard: { gap: 4 },
  heroLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiTile: { flexGrow: 1, flexBasis: '47%', gap: 3 },
  kpiLabel: { fontSize: 11.5, color: colors.textSecondary },
  cardTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 96, backgroundColor: colors.bg, borderRadius: radius.sm, padding: 10 },
  chartBar: { flex: 1, borderRadius: 3 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  actionButtonPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionButtonLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  actionButtonLabelPrimary: { color: colors.white },
  listHeader: { marginBottom: 2 },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  txnInfo: { flex: 1, gap: 2 },
  txnLabel: { fontSize: 13.5, color: colors.textPrimary },
  txnLabelVoided: { color: colors.textTertiary, textDecorationLine: 'line-through' },
  txnMeta: { fontSize: 11.5, color: colors.textTertiary },
});
