import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Party, PartyKind } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useAuth } from '@/context/AuthContext';
import { useParties, usePartyTotals } from '@/hooks/useParties';
import { colors, fontSize, spacing } from '@/theme';

type Tab = 'all' | PartyKind;

export default function PartiesScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('all');
  const parties = useParties(tab === 'all' ? undefined : tab);
  const totals = usePartyTotals();
  const currency = user?.base_currency ?? 'GNF';

  return (
    <Screen onRefresh={() => { parties.refetch(); totals.refetch(); }} refreshing={parties.isRefetching}>
      <View style={styles.header}>
        <Text style={styles.title}>Tiers & dettes</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.totalsRow}>
          <Card style={styles.totalTile}>
            <Text style={styles.totalLabel}>On me doit</Text>
            <AmountText amount={totals.data?.receivable ?? '0'} currency={currency} size={17} sign="neutral" />
          </Card>
          <Card style={styles.totalTile}>
            <Text style={styles.totalLabel}>Je dois</Text>
            <AmountText amount={totals.data?.payable ?? '0'} currency={currency} size={17} sign="neutral" />
          </Card>
        </View>

        <SegmentedControl
          options={[
            { value: 'all', label: 'Tous' },
            { value: 'client', label: 'Clients' },
            { value: 'supplier', label: 'Fournisseurs' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {parties.isLoading ? (
          <LoadingView />
        ) : parties.isError ? (
          <ErrorView message="Impossible de charger les tiers." onRetry={() => parties.refetch()} />
        ) : parties.data && parties.data.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="Aucun tiers"
            description="Un tiers se crée aussi directement depuis une vente ou une opération à crédit."
            actionLabel="+ Nouveau tiers"
            onAction={() => router.push('/parties/new')}
          />
        ) : (
          <View style={styles.list}>
            {parties.data?.map((party) => (
              <PartyRow key={party.id} party={party} currency={currency} />
            ))}
          </View>
        )}

        {parties.data && parties.data.length > 0 ? (
          <Button label="+ Nouveau tiers" variant="secondary" onPress={() => router.push('/parties/new')} />
        ) : null}
      </View>
    </Screen>
  );
}

function PartyRow({ party, currency }: { party: Party; currency: string }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/parties/[id]', params: { id: String(party.id) } })}>
      <Card style={styles.partyCard}>
        <View style={styles.partyInfo}>
          <Text style={styles.partyName}>{party.name}</Text>
          <Text style={styles.partyMeta}>{party.phone || 'Pas de téléphone'}</Text>
        </View>
        <AmountText amount={party.balance} currency={currency} size={14} sign="neutral" />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  totalsRow: { flexDirection: 'row', gap: spacing.sm },
  totalTile: { flex: 1, gap: 3 },
  totalLabel: { fontSize: 11.5, color: colors.textSecondary },
  list: { gap: spacing.sm },
  partyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  partyInfo: { flex: 1, gap: 2 },
  partyName: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  partyMeta: { fontSize: 11.5, color: colors.textTertiary },
});
