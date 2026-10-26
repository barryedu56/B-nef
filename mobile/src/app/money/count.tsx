import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { CashCount } from '@/api/types';
import { Alert } from '@/components/ui/Alert';
import { AmountField } from '@/components/ui/AmountField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PickerField } from '@/components/ui/PickerField';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { useActivities } from '@/hooks/useActivities';
import { useAccountsOverview, useCountCash } from '@/hooks/useAccounts';
import { formatAmount } from '@/lib/money';
import { colors, fontSize, radius, spacing } from '@/theme';

/** Vérification de caisse : on compte l'argent réellement présent, Bénef
 * compare au solde attendu et enregistre l'écart. */
export default function CountCashScreen() {
  const params = useLocalSearchParams<{ account?: string }>();
  const overview = useAccountsOverview();
  const activities = useActivities();
  const countCash = useCountCash();
  const accounts = overview.data?.accounts ?? [];
  // Activités avec stock d'abord : c'est là que circule l'argent du commerce.
  const acts = [...(activities.data ?? [])].sort((x, y) => Number(y.has_inventory) - Number(x.has_inventory));

  const [accountId, setAccountId] = useState(params.account ?? '');
  const [activityId, setActivityId] = useState('');
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CashCount | null>(null);

  const account = accounts.find((a) => String(a.id) === accountId) ?? accounts[0];
  const activity = acts.find((a) => String(a.id) === activityId) ?? acts[0];
  const expected = Number(account?.balance ?? 0);
  const countedValue = counted ? Number(counted.replace(',', '.')) : null;
  const diff = countedValue !== null && !Number.isNaN(countedValue) ? countedValue - expected : null;
  const currency = account?.effective_currency ?? '';

  const onSubmit = async () => {
    if (!account || !activity || countedValue === null || Number.isNaN(countedValue) || countedValue < 0) {
      setError("Indique le montant que tu as compté.");
      return;
    }
    setError(null);
    try {
      const record = await countCash.mutateAsync({
        accountId: account.id,
        input: { counted: String(countedValue), activity: activity.id, note: note.trim() },
      });
      setResult(record);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Vérification impossible.');
    }
  };

  if (result) {
    const d = Number(result.difference);
    return (
      <Screen edges={['top']}>
        <TopBar title="Vérification enregistrée" back />
        <View style={styles.content}>
          <Alert
            tone={d === 0 ? 'success' : 'info'}
            message={
              d === 0
                ? 'Ta caisse est juste : le montant compté correspond au solde.'
                : `Écart de ${formatAmount(Math.abs(d), result.currency)} (${d < 0 ? 'manque' : 'surplus'}). Le solde a été aligné sur ce que tu as compté, et l'écart compte dans tes ${d < 0 ? 'charges' : 'gains'}.`
            }
          />
          <Button label="Terminé" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <TopBar title="Vérifier une caisse" back />
      <View style={styles.content}>
        <Text style={styles.help}>Compte l'argent réellement présent (tiroir, solde Orange Money, relevé de banque) et saisis-le.</Text>
        <Card style={styles.card}>
          <PickerField
            label="Caisse"
            value={account ? String(account.id) : null}
            options={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
            onChange={(v) => {
              setAccountId(v);
              setCounted('');
            }}
          />
          <View style={styles.expected}>
            <Text style={styles.expectedLabel}>Selon Bénef, tu devrais avoir</Text>
            <Text style={styles.expectedValue}>{formatAmount(expected, currency)}</Text>
          </View>
          <AmountField label="Montant compté" value={counted} onChangeText={setCounted} placeholder="0" suffix={currency} />
          {diff !== null ? (
            <Text style={[styles.diff, { color: diff === 0 ? colors.positive : diff < 0 ? colors.negative : colors.warning }]}>
              {diff === 0 ? '✓ Caisse juste' : `${diff < 0 ? 'Manque' : 'Surplus'} : ${formatAmount(Math.abs(diff), currency)}`}
            </Text>
          ) : null}
          {acts.length > 1 && diff !== null && diff !== 0 ? (
            <PickerField
              label="Activité concernée par l'écart"
              value={activity ? String(activity.id) : null}
              options={acts.map((a) => ({ value: String(a.id), label: a.name }))}
              onChange={setActivityId}
            />
          ) : null}
          <TextField label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="ex. erreur de monnaie" />
        </Card>
        {error ? <Alert message={error} /> : null}
        <Button label="Enregistrer la vérification" icon="checkmark-circle-outline" onPress={onSubmit} loading={countCash.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.lg },
  help: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  expected: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  expectedLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  expectedValue: { fontSize: fontSize.lg, fontWeight: '800', color: colors.textPrimary },
  diff: { fontSize: fontSize.md, fontWeight: '700' },
});
