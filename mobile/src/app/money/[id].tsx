import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AccountIcon } from '@/components/AccountIcon';
import { kindLabel, TxnIcon } from '@/components/TxnIcon';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { TopBar } from '@/components/ui/TopBar';
import { useActivities } from '@/hooks/useActivities';
import { useAccountMovements, useAccountsOverview, useCashCounts } from '@/hooks/useAccounts';
import { formatRelativeDate } from '@/lib/dates';
import { formatAmount } from '@/lib/money';
import { useMoneyActivity } from '@/lib/moneyFilter';
import { colors, fontSize, spacing } from '@/theme';

/** Une caisse : son solde, ses derniers mouvements, ses vérifications. */
export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);
  const filter = useMoneyActivity();
  const overview = useAccountsOverview(filter);
  const movements = useAccountMovements(accountId, filter);
  const counts = useCashCounts(accountId, filter);
  const activities = useActivities();
  const filtered = overview.data?.activity ?? null;

  const account = overview.data?.accounts.find((a) => a.id === accountId);
  if (overview.isLoading) return <LoadingView />;
  if (!account) return <ErrorView message="Caisse introuvable." onRetry={() => overview.refetch()} />;

  const activityName = new Map((activities.data ?? []).map((a) => [a.id, a.name]));
  const currency = account.effective_currency;

  return (
    <Screen edges={['top']} onRefresh={() => { overview.refetch(); movements.refetch(); counts.refetch(); }} refreshing={overview.isRefetching}>
      <TopBar title={account.name} subtitle={filtered ? filtered.name : undefined} back />
      <View style={styles.content}>
        <Card style={styles.balanceCard}>
          <AccountIcon account={account} size={48} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.label}>{filtered ? `Part de ${filtered.name}` : 'Solde actuel'}</Text>
            <AmountText amount={account.balance ?? '0'} currency={currency} size={24} weight="800" sign={Number(account.balance) < 0 ? 'negative' : 'neutral'} />
            {filtered && account.account_balance !== undefined ? (
              <Text style={styles.txnMeta}>Solde réel de la caisse : {formatAmount(account.account_balance, currency)}</Text>
            ) : null}
          </View>
        </Card>
        <Button
          label="Vérifier cette caisse"
          icon="calculator-outline"
          onPress={() => router.push({ pathname: '/money/count', params: { account: String(account.id) } })}
        />

        <Text style={styles.sectionTitle}>Derniers mouvements</Text>
        {movements.isLoading ? (
          <LoadingView />
        ) : (movements.data?.results ?? []).length === 0 ? (
          <EmptyState icon="swap-vertical-outline" title="Aucun mouvement" description="Les opérations payées avec cette caisse apparaîtront ici." />
        ) : (
          <Card padding={0}>
            {(movements.data?.results ?? []).slice(0, 30).map((txn, i) => (
              <View key={txn.id} style={[styles.txn, i > 0 && styles.txnBorder, txn.is_voided && { opacity: 0.5 }]}>
                <TxnIcon kind={txn.kind} direction={txn.direction} muted={txn.is_voided} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.txnLabel} numberOfLines={1}>
                    {kindLabel(txn.kind, txn.direction)}
                    {txn.is_voided ? ' · annulée' : txn.is_credit && txn.kind !== 'settlement' ? ' · à crédit' : ''}
                  </Text>
                  <Text style={styles.txnMeta} numberOfLines={1}>
                    {formatRelativeDate(txn.occurred_on)} · {activityName.get(txn.activity) ?? ''}
                  </Text>
                </View>
                <AmountText amount={txn.amount} currency={txn.currency} size={13.5} sign={txn.direction === 'in' ? 'positive' : 'negative'} />
              </View>
            ))}
          </Card>
        )}

        {(counts.data ?? []).length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Vérifications</Text>
            <Card padding={0}>
              {(counts.data ?? []).slice(0, 10).map((c, i) => {
                const diff = Number(c.difference);
                return (
                  <View key={c.id} style={[styles.txn, i > 0 && styles.txnBorder]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.txnLabel}>
                        {formatRelativeDate(c.created_at.slice(0, 10))} · compté {formatAmount(c.counted, c.currency)}
                      </Text>
                      <Text style={styles.txnMeta}>
                        Attendu {formatAmount(c.expected, c.currency)}
                        {c.activity_only ? ` · part de ${c.activity_name}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.diff, { color: diff === 0 ? colors.positive : diff < 0 ? colors.negative : colors.warning }]}>
                      {diff === 0 ? 'Juste' : `${diff > 0 ? '+' : ''}${formatAmount(c.difference, c.currency)}`}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  balanceCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '600' },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.sm },
  txn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 11 },
  txnBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  txnLabel: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
  txnMeta: { fontSize: fontSize.xs, color: colors.textTertiary },
  diff: { fontSize: fontSize.sm, fontWeight: '700' },
});
