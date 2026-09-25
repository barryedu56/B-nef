import { Alert, StyleSheet, Text, View } from 'react-native';

import { ACTIVITY_TYPE_OPTIONS } from '@/api/activities';
import { ApiError } from '@/api/client';
import type { Activity } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView, LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { TopBar } from '@/components/ui/TopBar';
import { useArchivedActivities, useUpdateActivity } from '@/hooks/useActivities';
import { colors, fontSize, spacing } from '@/theme';

export default function ArchivedActivitiesScreen() {
  const archived = useArchivedActivities();

  return (
    <Screen edges={['top']} onRefresh={() => archived.refetch()} refreshing={archived.isRefetching}>
      <TopBar title="Activités archivées" back />
      <View style={styles.content}>
        {archived.isLoading ? (
          <LoadingView />
        ) : archived.isError ? (
          <ErrorView message="Impossible de charger les activités archivées." onRetry={() => archived.refetch()} />
        ) : archived.data && archived.data.length === 0 ? (
          <EmptyState icon="archive-outline" title="Aucune activité archivée" description="Les activités que tu archives apparaîtront ici." />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {archived.data?.map((activity) => (
              <ArchivedRow key={activity.id} activity={activity} />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function ArchivedRow({ activity }: { activity: Activity }) {
  const update = useUpdateActivity(activity.id);
  const typeLabel = ACTIVITY_TYPE_OPTIONS.find((o) => o.value === activity.type)?.label ?? activity.type_display;

  const onReactivate = () => {
    Alert.alert('Réactiver cette activité ?', `« ${activity.name} » réapparaîtra dans ta liste d'activités.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Réactiver',
        onPress: async () => {
          try {
            await update.mutateAsync({ is_archived: false });
          } catch (e) {
            Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Impossible de réactiver cette activité.');
          }
        },
      },
    ]);
  };

  return (
    <Card style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{activity.name}</Text>
        <Text style={styles.rowMeta}>{typeLabel}</Text>
      </View>
      <Button label="Réactiver" variant="secondary" fullWidth={false} onPress={onReactivate} loading={update.isPending} />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  rowMeta: { fontSize: 11.5, color: colors.textTertiary },
});
