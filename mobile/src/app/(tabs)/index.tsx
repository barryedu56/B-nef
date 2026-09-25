import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useActivities } from '@/hooks/useActivities';
import { useGlobalSummary } from '@/hooks/useReports';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { ACTIVITY_TYPE_OPTIONS } from '@/api/activities';
import type { Activity } from '@/api/types';
import { colors, fontSize, spacing } from '@/theme';

export default function ActivitiesScreen() {
  const activities = useActivities();
  const summary = useGlobalSummary('month');

  const netByActivity = new Map((summary.data?.by_activity ?? []).map((row) => [row.activity_id, row]));

  if (activities.isLoading) return <LoadingView label="Chargement des activités…" />;
  if (activities.isError) {
    return <ErrorView message="Impossible de charger tes activités." onRetry={() => activities.refetch()} />;
  }

  return (
    <Screen onRefresh={() => { activities.refetch(); summary.refetch(); }} refreshing={activities.isRefetching}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes activités</Text>
      </View>

      <View style={styles.content}>
        {summary.data ? (
          <Card tone="muted" style={styles.totalCard}>
            <Text style={styles.totalLabel}>
              Bénéfice net — {summary.data.period_start.slice(0, 7)} · toutes activités
            </Text>
            <AmountText amount={summary.data.net_profit} currency={summary.data.currency} size={24} />
          </Card>
        ) : null}

        {activities.data && activities.data.length === 0 ? (
          <EmptyState
            icon="briefcase-outline"
            title="Aucune activité pour l’instant"
            description="Une activité peut être une boutique, un salaire, un taxi, un champ, ou les dépenses de la maison."
            actionLabel="Créer ma première activité"
            onAction={() => router.push('/activity/new')}
          />
        ) : (
          <View style={styles.list}>
            {activities.data?.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} netProfit={netByActivity.get(activity.id)} />
            ))}
          </View>
        )}

        {activities.data && activities.data.length > 0 ? (
          <Button label="+ Nouvelle activité" variant="secondary" onPress={() => router.push('/activity/new')} style={styles.dashedButton} />
        ) : null}
      </View>
    </Screen>
  );
}

function ActivityCard({ activity, netProfit }: { activity: Activity; netProfit?: { net_profit: string; currency: string } }) {
  const typeLabel = ACTIVITY_TYPE_OPTIONS.find((o) => o.value === activity.type)?.label ?? activity.type_display;
  return (
    <Pressable onPress={() => router.push({ pathname: '/activity/[id]', params: { id: String(activity.id) } })}>
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{activity.name}</Text>
            <View style={styles.chipRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{typeLabel}</Text>
              </View>
              {activity.has_inventory ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Inventaire</Text>
                </View>
              ) : null}
              {activity.has_debts ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Dettes</Text>
                </View>
              ) : null}
            </View>
          </View>
          {netProfit ? (
            <AmountText amount={netProfit.net_profit} currency={netProfit.currency} size={15} />
          ) : (
            <AmountText amount="0" currency={activity.currency} size={15} sign="neutral" />
          )}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  totalCard: { gap: 3 },
  totalLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  list: { gap: spacing.md },
  card: { gap: 0 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardInfo: { flex: 1, gap: 6 },
  cardName: { fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: '#f0f0ee', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  tagText: { fontSize: 11, color: colors.textPrimary },
  dashedButton: { borderStyle: 'dashed' },
});
