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
import { DueBanner } from '@/components/DueBanner';
import { InstallHint } from '@/components/InstallHint';
import { SyncBanner } from '@/components/SyncBanner';
import { useAuth } from '@/context/AuthContext';
import { homeWords } from '@/lib/activityWords';
import { colors, fontSize, radius, shadow, spacing } from '@/theme';

export default function ActivitiesScreen() {
  const { user } = useAuth();
  const activities = useActivities();
  const home = homeWords(activities.data);
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
          <Text style={styles.hello}>Bonjour {capitalize(user?.username)}</Text>
          <Text style={styles.date}>{todayLabel()}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <InstallHint />
        <DueBanner />
        {summary.data ? (
          <HeroCard
            label={`${home.personal ? 'Ce qui te reste' : 'Bénéfice net'} ce mois · toutes activités`}
            amount={summary.data.net_profit}
            currency={summary.data.currency}>
            <HeroStat label={home.income} amount={summary.data.revenue} currency={summary.data.currency} tone="in" />
            <HeroStat label="Dépenses" amount={summary.data.expenses} currency={summary.data.currency} tone="out" />
          </HeroCard>
        ) : null}

        {activities.data && activities.data.length === 1 ? <QuickActions activity={activities.data[0]} /> : null}

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

function capitalize(name?: string) {
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
}

type IconName = ComponentProps<typeof Ionicons>['name'];

/** « Que veux-tu faire ? » : quatre gros boutons avec icône, pour l'activité
 * unique de l'utilisateur (le cas le plus courant). */
function QuickActions({ activity }: { activity: Activity }) {
  const id = String(activity.id);
  const tiles: { label: string; icon: IconName; color: string; primary?: boolean; onPress: () => void }[] = [];
  if (activity.has_inventory) {
    tiles.push({ label: 'Vendre', icon: 'cart-outline', color: colors.white, primary: true, onPress: () => router.push({ pathname: '/activity/[id]/new-sale', params: { id } }) });
  } else {
    tiles.push({ label: 'Entrée', icon: 'arrow-down-circle-outline', color: colors.white, primary: true, onPress: () => router.push({ pathname: '/activity/[id]/new-transaction', params: { id, direction: 'in' } }) });
  }
  tiles.push({ label: 'Dépense', icon: 'arrow-up-circle-outline', color: colors.negative, onPress: () => router.push({ pathname: '/activity/[id]/new-transaction', params: { id, direction: 'out' } }) });
  if (activity.has_inventory) {
    tiles.push({ label: 'Mon stock', icon: 'cube-outline', color: colors.warning, onPress: () => router.push({ pathname: '/activity/[id]/products', params: { id } }) });
  }
  if (activity.has_debts) {
    tiles.push({ label: 'Crédits', icon: 'people-outline', color: colors.info, onPress: () => router.push('/(tabs)/parties') });
  }
  if (tiles.length < 4) {
    tiles.push({ label: 'Mon activité', icon: 'stats-chart-outline', color: colors.accent, onPress: () => router.push({ pathname: '/activity/[id]', params: { id } }) });
  }
  return (
    <View style={styles.quick}>
      <Text style={styles.sectionTitle}>Que veux-tu faire ?</Text>
      <View style={styles.quickGrid}>
        {tiles.slice(0, 4).map((tile) => (
          <Pressable
            key={tile.label}
            onPress={tile.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.tile, tile.primary && styles.tilePrimary, pressed && styles.cardPressed]}>
            <Ionicons name={tile.icon} size={32} color={tile.color} />
            <Text style={[styles.tileLabel, tile.primary && styles.tileLabelPrimary]}>{tile.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

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
  hello: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.3 },
  date: { fontSize: fontSize.sm, color: colors.textSecondary, textTransform: 'capitalize' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.sm },
  quick: { gap: spacing.md },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    height: 104,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    padding: spacing.lg,
    justifyContent: 'space-between',
    ...shadow.md,
  },
  tilePrimary: { backgroundColor: colors.accent, ...shadow.accent },
  tileLabel: { fontSize: 17, fontWeight: '900', color: colors.textPrimary },
  tileLabelPrimary: { color: colors.white },
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
    borderColor: colors.borderStrong,
  },
  addLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.accent },
});
