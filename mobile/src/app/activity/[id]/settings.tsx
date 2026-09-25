import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { LoadingView } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { TopBar } from '@/components/ui/TopBar';
import { ACTIVITY_TYPE_OPTIONS } from '@/api/activities';
import { useActivity, useUpdateActivity } from '@/hooks/useActivities';
import { colors, fontSize, spacing } from '@/theme';

export default function ActivitySettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activityId = Number(id);
  const activity = useActivity(activityId);
  const update = useUpdateActivity(activityId);
  const [archiving, setArchiving] = useState(false);

  if (activity.isLoading || !activity.data) return <LoadingView />;
  const act = activity.data;
  const typeLabel = ACTIVITY_TYPE_OPTIONS.find((o) => o.value === act.type)?.label ?? act.type_display;

  const toggle = (field: 'has_inventory' | 'has_debts' | 'has_budget') => (value: boolean) => {
    update.mutate({ [field]: value });
  };

  const onArchive = () => {
    Alert.alert('Archiver cette activité ?', 'Elle disparaîtra de la liste mais ses données restent conservées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Archiver',
        style: 'destructive',
        onPress: async () => {
          setArchiving(true);
          try {
            await update.mutateAsync({ is_archived: true });
            router.replace('/(tabs)');
          } finally {
            setArchiving(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <TopBar title={act.name} back />
      <View style={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Informations</Text>
          <Row label="Nom" value={act.name} />
          <Row label="Type" value={typeLabel} />
          <Row label="Devise" value={act.currency} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Modules</Text>
          <ModuleRow
            label="Inventaire"
            description="Suivi du stock, ventes par produit, valeur du stock"
            value={act.has_inventory}
            onChange={toggle('has_inventory')}
          />
          <ModuleRow
            label="Crédits & dettes"
            description="Clients qui vous doivent, fournisseurs à payer"
            value={act.has_debts}
            onChange={toggle('has_debts')}
          />
          <ModuleRow
            label="Budget & prévision"
            description="Fixer un budget par catégorie et comparer prévu / réalisé"
            value={act.has_budget}
            onChange={toggle('has_budget')}
          />
        </Card>

        <Text onPress={onArchive} style={[styles.archiveLink, archiving && styles.archiveLinkDisabled]}>
          Archiver cette activité
        </Text>
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ModuleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.moduleRow}>
      <View style={styles.moduleText}>
        <Text style={styles.moduleLabel}>{label}</Text>
        <Text style={styles.moduleDescription}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.borderStrong }} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.md },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  rowValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  moduleText: { flex: 1, gap: 2 },
  moduleLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  moduleDescription: { fontSize: fontSize.xs, color: colors.textTertiary },
  archiveLink: { fontSize: fontSize.sm, color: colors.negative, fontWeight: '600', textAlign: 'center', paddingVertical: spacing.sm },
  archiveLinkDisabled: { opacity: 0.5 },
});
