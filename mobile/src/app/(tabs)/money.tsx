import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AccountOverviewRow } from '@/api/types';
import { AccountIcon } from '@/components/AccountIcon';
import { SyncBanner } from '@/components/SyncBanner';
import { AmountText } from '@/components/ui/AmountText';
import { Card } from '@/components/ui/Card';
import { HeroCard } from '@/components/ui/HeroCard';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAccountsOverview } from '@/hooks/useAccounts';
import { formatRelativeDate } from '@/lib/dates';
import { colors, fontSize, radius, spacing } from '@/theme';

/** « Mon argent » : combien j'ai réellement, et dans quelle caisse. */
export default function MoneyScreen() {
  const overview = useAccountsOverview();

  if (overview.isLoading) return <LoadingView label="Calcul de tes caisses…" />;
  if (overview.isError || !overview.data) {
    return <ErrorView message="Impossible de charger tes caisses." onRetry={() => overview.refetch()} />;
  }
  const data = overview.data;

  return (
    <Screen onRefresh={() => overview.refetch()} refreshing={overview.isRefetching}>
      <SyncBanner />
      <View style={styles.header}>
        <Text style={styles.title}>Mon argent</Text>
      </View>
      <View style={styles.content}>
        <HeroCard label="Tout ton argent aujourd'hui" amount={data.total} currency={data.currency} />

        <View style={styles.actions}>
          <QuickAction icon="swap-horizontal-outline" label="Transférer" onPress={() => router.push('/money/transfer')} />
          <QuickAction icon="add-circle-outline" label="Apport" onPress={() => router.push({ pathname: '/money/personal', params: { kind: 'contribution' } })} />
          <QuickAction icon="remove-circle-outline" label="Retrait" onPress={() => router.push({ pathname: '/money/personal', params: { kind: 'withdrawal' } })} />
          <QuickAction icon="calculator-outline" label="Vérifier" onPress={() => router.push('/money/count')} />
        </View>

        <Text style={styles.sectionTitle}>Mes caisses</Text>
        {data.accounts.map((account) => (
          <AccountRow key={account.id} account={account} />
        ))}
        {Number(data.unassigned) !== 0 ? (
          <Card style={styles.row}>
            <Text style={[styles.name, { flex: 1 }]}>Sans caisse (anciennes opérations)</Text>
            <AmountText amount={data.unassigned} currency={data.currency} size={15} weight="700" sign="neutral" />
          </Card>
        ) : null}

        <Pressable onPress={() => router.push('/categories')} style={styles.manage} accessibilityRole="link">
          <Ionicons name="settings-outline" size={16} color={colors.accent} />
          <Text style={styles.manageText}>Ajouter ou renommer une caisse</Text>
        </Pressable>
        <Text style={styles.help}>
          Chaque vente, dépense ou achat payé va dans la caisse choisie comme moyen de paiement (Espèces par défaut).
          Vérifie tes caisses de temps en temps : compte l'argent réel, Bénef enregistre l'écart.
        </Text>
      </View>
    </Screen>
  );
}

function QuickAction({ icon, label, onPress }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quick, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function AccountRow({ account }: { account: AccountOverviewRow }) {
  const negative = Number(account.balance) < 0;
  const check = account.last_count;
  return (
    <Pressable onPress={() => router.push({ pathname: '/money/[id]', params: { id: String(account.id) } })}>
      {({ pressed }) => (
        <Card style={pressed ? styles.rowPressed : styles.row}>
          <AccountIcon account={account} />
          <View style={styles.info}>
            <Text style={styles.name}>{account.name}</Text>
            <Text style={[styles.meta, negative && { color: colors.negative }]}>
              {negative
                ? 'Solde négatif : une opération est peut-être dans la mauvaise caisse'
                : check
                  ? `Vérifiée ${formatRelativeDate(check.at.slice(0, 10)).toLowerCase()}${Number(check.difference) !== 0 ? ' · écart corrigé' : ''}`
                  : 'Jamais vérifiée'}
            </Text>
          </View>
          <AmountText amount={account.balance ?? '0'} currency={account.effective_currency} size={16} weight="700" sign={negative ? 'negative' : 'neutral'} />
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.textPrimary },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textPrimary },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowPressed: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, opacity: 0.88 },
  info: { flex: 1, gap: 3 },
  name: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: fontSize.xs, color: colors.textTertiary },
  manage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  manageText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.accent },
  help: { fontSize: fontSize.xs, color: colors.textTertiary, lineHeight: 17, textAlign: 'center' },
});
