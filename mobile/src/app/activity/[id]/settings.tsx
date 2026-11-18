import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { Activity } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PickerField } from '@/components/ui/PickerField';
import { TextField } from '@/components/ui/TextField';
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
  const [name, setName] = useState('');
  const [type, setType] = useState<Activity['type'] | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);

  useEffect(() => {
    if (activity.data) {
      setName(activity.data.name);
      setType(activity.data.type);
    }
  }, [activity.data]);

  if (activity.isLoading || !activity.data) return <LoadingView />;
  const act = activity.data;
  const changed = name.trim() !== act.name || type !== act.type;

  const onSaveInfo = async () => {
    if (!name.trim()) {
      setInfoError('Donne un nom à ton activité.');
      return;
    }
    setInfoError(null);
    try {
      await update.mutateAsync({ name: name.trim(), ...(type ? { type } : {}) });
    } catch (e) {
      setInfoError(e instanceof ApiError ? e.message : "Impossible d'enregistrer.");
    }
  };

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
          <TextField label="Nom" value={name} onChangeText={setName} />
          <PickerField
            label="Type"
            value={type}
            options={ACTIVITY_TYPE_OPTIONS}
            onChange={(value) => setType(value as Activity['type'])}
          />
          <Row label="Devise" value={act.currency} />
          {infoError ? <Text style={styles.error}>{infoError}</Text> : null}
          {changed ? <Button label="Enregistrer" onPress={onSaveInfo} loading={update.isPending} /> : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Modules</Text>
          <ModuleRow
            label="Inventaire"
            description="Stock et ventes par produit"
            value={act.has_inventory}
            onChange={toggle('has_inventory')}
          />
          <ModuleRow
            label="Crédits & dettes"
            description="Qui te doit, à qui tu dois"
            value={act.has_debts}
            onChange={toggle('has_debts')}
          />
          <ModuleRow
            label="Budget & prévision"
            description="Un plafond par dépense"
            value={act.has_budget}
            onChange={toggle('has_budget')}
          />
        </Card>

        <Button
          label="Assistant de démarrage"
          icon="rocket-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: '/activity/[id]/onboarding', params: { id: String(act.id) } })}
        />

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
      <Switch thumbColor={colors.white} value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.borderStrong }} />
    </View>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: fontSize.sm, color: colors.negative },
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
