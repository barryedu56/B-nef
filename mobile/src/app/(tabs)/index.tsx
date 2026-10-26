import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useActivities } from '@/hooks/useActivities';
import { useGlobalSummary } from '@/hooks/useReports';
import { AmountText } from '@/components/ui/AmountText';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { HeroCard, HeroStat } from '@/components/ui/HeroCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { ACTIVITY_TYPE_OPTIONS } from '@/api/activities';
import type { Activity } from '@/api/types';
import { SyncBanner } from '@/components/SyncBanner';
import { useAuth } from '@/context/AuthContext';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function ActivitiesScreen() {
  const { user } = useAuth();
  const activities = useActivities();
  const summary = useGlobalSummary('month');

  const netByActivity = new Map((summary.data?.by_activity ?? []).map((row) => [row.activity_id, row]));

  if (activities.isLoading) return <LoadingView label="Chargement des activités…" />;
  if (activities.isError) {
    return <ErrorView message="Impossible de charger tes activités." onRetry={() => activities.refetch()} />;
  }

  return (
    <Screen onRefresh={() => { activities.refetch(); summary.refetch(); }} refreshing={activities.isRefetching}>
      <SyncBanner />
      <View style={styles.header}>
        <Avatar url={user?.avatar} name={user?.username} size={44} />
        <View style={styles.greeting}>
          <Text style={styles.hello}>Bonjour {user?.username} 👋</Text>
          <Text style={styles.date}>{todayLabel()}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {summary.data ? (
          <HeroCard label="Bénéfice net ce mois · toutes activités" amount={summary.data.net_profit} currency={summary.data.currency}>
            <HeroStat label="Chiffre d'affaires" amount={summary.data.revenue} currency={summary.data.currency} />
            <HeroStat label="Dépenses" amount={summary.data.expenses} currency={summary.data.currency} />
          </HeroCard>
        ) : null}

        <Text style={styles.sectionTitle}>Mes activités</Text>

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
          <Pressable onPress={() => router.push('/activity/new')} style={styles.addCard} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
            <Text style={styles.addLabel}>Nouvelle activité</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const TYPE_ICONS: Partial<Record<Activity['type'], ComponentProps<typeof Ionicons>['name']>> = {
  commerce: 'storefront-outline',
  service: 'briefcase-outline',
  salary: 'wallet-outline',
  rental: 'business-outline',
  farming: 'leaf-outline',
  household: 'home-outline',
};

function todayLabel() {
  return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function ActivityCard({ activity, netProfit }: { activity: Activity; netProfit?: { net_profit: string; currency: string } }) {
  const typeLabel = ACTIVITY_TYPE_OPTIONS.find((o) => o.value === activity.type)?.label ?? activity.type_display;
  const modules = [activity.has_inventory && 'Stock', activity.has_debts && 'Dettes', activity.has_budget && 'Budget'].filter(Boolean);
  return (
    <Pressable onPress={() => router.push({ pathname: '/activity/[id]', params: { id: String(activity.id) } })}>
      {({ pressed }) => (
        <Card style={pressed ? styles.cardPressed : undefined}>
          <View style={styles.cardRow}>
            <View style={styles.cardIcon}>
              <Ionicons name={TYPE_ICONS[activity.type] ?? 'apps-outline'} size={20} color={colors.accent} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>
                {activity.name}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {[typeLabel, ...modules].join(' · ')}
              </Text>
            </View>
            <View style={styles.cardAmount}>
              {netProfit ? (
                <AmountText amount={netProfit.net_profit} currency={netProfit.currency} size={15} weight="700" />
              ) : (
                <AmountText amount="0" currency={activity.currency} size={15} weight="700" sign="neutral" />
              )}
              <Text style={styles.cardAmountLabel}>ce mois</Text>
            </View>
          </View>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  greeting: { flex: 1, gap: 2 },
  hello: { fontSize: fontSize.xl, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
  date: { fontSize: fontSize.sm, color: colors.textSecondary, textTransform: 'capitalize' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.sm },
  list: { gap: spacing.sm + 2 },
  cardPressed: { opacity: 0.9 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 3 },
  cardName: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  cardMeta: { fontSize: fontSize.xs, color: colors.textSecondary },
  cardAmount: { alignItems: 'flex-end', gap: 1 },
  cardAmountLabel: { fontSize: 10.5, color: colors.textTertiary },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#c7cbf3',
  },
  addLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.accent },
});
