import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Period, Transaction } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { BudgetProgress } from '@/components/BudgetProgress';
import { Card } from '@/components/ui/Card';
import { TxnIcon } from '@/components/TxnIcon';
import { HeroCard, HeroStat } from '@/components/ui/HeroCard';
import { KpiTile } from '@/components/ui/KpiTile';
import { ProfitChart } from '@/components/ui/ProfitChart';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TopBar } from '@/components/ui/TopBar';
import { useActivity } from '@/hooks/useActivities';
import { useBudgetsStatus } from '@/hooks/useBudgets';
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

        <HeroCard label="Bénéfice net de la période" amount={data.net_profit} currency={data.currency}>
          <HeroStat label="Chiffre d'affaires" amount={data.revenue} currency={data.currency} />
          <HeroStat label="Caisse" amount={data.cash_balance} currency={data.currency} />
        </HeroCard>

        <View style={styles.kpiGrid}>
          {act.has_inventory ? <KpiTile label="Coût des ventes" amount={data.cogs} currency={data.currency} icon="cube-outline" tone="negative" /> : null}
          {act.has_inventory ? <KpiTile label="Marge brute" amount={data.gross_margin} currency={data.currency} icon="bar-chart-outline" tone="info" /> : null}
          <KpiTile label="Charges" amount={data.expenses} currency={data.currency} icon="receipt-outline" tone="negative" />
          {act.has_inventory ? <KpiTile label="Valeur du stock" amount={data.stock_value} currency={data.currency} icon="layers-outline" tone="warning" /> : null}
          {act.has_inventory && Number(data.personal_use) > 0 ? (
            <KpiTile label="Consommé perso" amount={data.personal_use} currency={data.currency} icon="restaurant-outline" tone="warning" />
          ) : null}
        </View>

        {data.timeseries.length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>Évolution du bénéfice</Text>
            <ProfitChart series={data.timeseries} />
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
              label="Produits & stock"
              onPress={() => router.push({ pathname: '/activity/[id]/products', params: { id } })}
            />
          ) : null}
        </View>

        {act.has_budget ? <ActivityBudgetsCard activityId={act.id} /> : null}

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

function ActivityBudgetsCard({ activityId }: { activityId: number }) {
  const budgets = useBudgetsStatus(activityId);
  const rows = budgets.data ?? [];
  return (
    <Card>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Budgets</Text>
        <Pressable
          hitSlop={8}
          onPress={() => router.push({ pathname: '/budgets', params: { activity: String(activityId) } })}>
          <Text style={styles.budgetLink}>{rows.length > 0 ? 'Gérer' : 'Créer'}</Text>
        </Pressable>
      </View>
      {rows.length > 0 ? (
        rows.map((b) => <BudgetProgress key={b.id} budget={b} />)
      ) : (
        <Text style={styles.budgetEmpty}>Aucun budget pour cette activité.</Text>
      )}
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
  // Numéro provisoire < 0 : saisie hors-ligne, pas encore sur le serveur.
  const queued = txn.id < 0;
  const meta = [
    formatRelativeDate(txn.occurred_on),
    paymentName,
    queued ? "en attente d'envoi" : null,
    txn.is_voided ? 'annulée' : txn.is_credit && !txn.is_settled ? 'à crédit' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      style={styles.txnRow}
      disabled={queued}
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: String(txn.id) } })}>
      <TxnIcon kind={txn.kind} direction={txn.direction} muted={txn.is_voided || queued} />
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
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetLink: { fontSize: fontSize.sm, fontWeight: '600', color: colors.accent },
  budgetEmpty: { fontSize: fontSize.xs, color: colors.textTertiary },
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, gap: spacing.md },
  periodBlock: { gap: spacing.sm },
  periodNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  periodLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionButton: {
    // Largeur selon le texte (« Produits & stock » est plus long que
    // « + Vente »), l'espace restant partagé : chaque libellé tient sur une ligne.
    flexGrow: 1,
    flexBasis: 'auto',
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  actionButtonPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionButtonLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  actionButtonLabelPrimary: { color: colors.white },
  listHeader: { marginBottom: 2 },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  txnInfo: { flex: 1, gap: 2 },
  txnLabel: { fontSize: 13.5, color: colors.textPrimary },
  txnLabelVoided: { color: colors.textTertiary, textDecorationLine: 'line-through' },
  txnMeta: { fontSize: 11.5, color: colors.textTertiary },
});
