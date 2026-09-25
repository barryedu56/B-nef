import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { ACTIVITY_TYPE_OPTIONS } from '@/api/activities';
import { ApiError } from '@/api/client';
import { AmountField } from '@/components/ui/AmountField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PickerField } from '@/components/ui/PickerField';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { useCreateActivity } from '@/hooks/useActivities';
import { useAuth } from '@/context/AuthContext';
import { colors, fontSize, spacing } from '@/theme';

const CURRENCY_OPTIONS = [
  { value: 'GNF', label: 'Franc guinéen (GNF)' },
  { value: 'XOF', label: 'Franc CFA — BCEAO (XOF)' },
  { value: 'USD', label: 'Dollar américain (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
];

export default function NewActivityScreen() {
  const { user } = useAuth();
  const create = useCreateActivity();

  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof ACTIVITY_TYPE_OPTIONS)[number]['value']>('commerce');
  const [currency, setCurrency] = useState(user?.base_currency ?? 'GNF');
  const [hasInventory, setHasInventory] = useState(false);
  const [hasDebts, setHasDebts] = useState(false);
  const [hasBudget, setHasBudget] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!name.trim()) {
      setError('Donne un nom à cette activité.');
      return;
    }
    setError(null);
    try {
      const activity = await create.mutateAsync({
        name: name.trim(),
        type,
        currency,
        has_inventory: hasInventory,
        has_debts: hasDebts,
        has_budget: hasBudget,
        opening_balance: openingBalance || '0',
      });
      router.replace({ pathname: '/activity/[id]', params: { id: String(activity.id) } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible de créer l’activité.');
    }
  };

  return (
    <Screen scroll edges={['top']}>
      <TopBar title="Nouvelle activité" back />
      <View style={styles.content}>
        <TextField label="Nom" value={name} onChangeText={setName} placeholder="ex. Boutique du marché" />
        <PickerField label="Type" value={type} options={ACTIVITY_TYPE_OPTIONS} onChange={(v) => setType(v as typeof type)} />
        <PickerField label="Devise" value={currency} options={CURRENCY_OPTIONS} onChange={setCurrency} />
        <AmountField
          label="Solde de caisse initial (facultatif)"
          value={openingBalance}
          onChangeText={setOpeningBalance}
          suffix={currency}
        />

        <Card style={styles.modulesCard}>
          <Text style={styles.modulesTitle}>Modules</Text>
          <ModuleRow
            label="Inventaire"
            description="Produits, stock, coût moyen pondéré"
            value={hasInventory}
            onChange={setHasInventory}
          />
          <ModuleRow
            label="Crédits & dettes"
            description="Clients qui doivent, fournisseurs à payer"
            value={hasDebts}
            onChange={setHasDebts}
          />
          <ModuleRow
            label="Budget & prévision"
            description="Fixer un budget et comparer au réalisé"
            value={hasBudget}
            onChange={setHasBudget}
          />
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Créer l’activité" onPress={onSubmit} loading={create.isPending} />
      </View>
    </Screen>
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
  modulesCard: { gap: spacing.md },
  modulesTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  moduleText: { flex: 1, gap: 2 },
  moduleLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  moduleDescription: { fontSize: fontSize.xs, color: colors.textTertiary },
  error: { fontSize: fontSize.sm, color: colors.negative },
});
