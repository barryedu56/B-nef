import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { Alert } from '@/components/ui/Alert';
import { AmountField } from '@/components/ui/AmountField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PickerField } from '@/components/ui/PickerField';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { useActivities } from '@/hooks/useActivities';
import { useMoneyActivity } from '@/lib/moneyFilter';
import { useAccountsOverview } from '@/hooks/useAccounts';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { todayISO } from '@/lib/dates';
import { formatAmount } from '@/lib/money';
import { colors, fontSize, spacing } from '@/theme';

const COPY = {
  contribution: {
    title: 'Apport personnel',
    button: "Enregistrer l'apport",
    help: "De l'argent que tu ajoutes de ta poche (ou d'un prêt de proche) : il entre dans la caisse, mais ce n'est pas une vente — ton bénéfice ne change pas.",
    placeholder: 'ex. économies, aide de la famille',
  },
  withdrawal: {
    title: 'Retrait personnel',
    button: 'Enregistrer le retrait',
    help: "De l'argent que tu prends pour toi (salaire, besoins de la famille) : il sort de la caisse, mais ce n'est pas une dépense de l'activité — ton bénéfice ne change pas.",
    placeholder: 'ex. dépenses de la famille',
  },
};

/** Apport ou retrait personnel : bouge la caisse, jamais le bénéfice. */
export default function PersonalMoneyScreen() {
  const { kind: kindParam } = useLocalSearchParams<{ kind?: string }>();
  const kind = kindParam === 'withdrawal' ? 'withdrawal' : 'contribution';
  const copy = COPY[kind];
  const overview = useAccountsOverview();
  const activities = useActivities();
  const create = useCreateTransaction();
  const accounts = overview.data?.accounts ?? [];
  // Activités avec stock d'abord : c'est là que circule l'argent du commerce.
  const acts = [...(activities.data ?? [])].sort((x, y) => Number(y.has_inventory) - Number(x.has_inventory));

  const [accountId, setAccountId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const account = accounts.find((a) => String(a.id) === accountId) ?? accounts[0];
  const filter = useMoneyActivity();
  const activity = acts.find((a) => String(a.id) === activityId) ?? acts.find((a) => a.id === filter) ?? acts[0];

  const onSubmit = async () => {
    const value = Number(amount.replace(',', '.'));
    if (!account || !activity) {
      setError('Choisis la caisse et l’activité.');
      return;
    }
    if (!value || value <= 0) {
      setError('Indique le montant.');
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({
        activity: activity.id,
        direction: kind === 'contribution' ? 'in' : 'out',
        kind,
        amount: String(value),
        currency: account.effective_currency,
        occurred_on: todayISO(),
        payment_method: account.id,
        note: note.trim() || copy.title,
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'enregistrer.");
    }
  };

  return (
    <Screen edges={['top']}>
      <TopBar title={copy.title} back />
      <View style={styles.content}>
        <Text style={styles.help}>{copy.help}</Text>
        <Card style={styles.card}>
          <PickerField
            label="Caisse"
            value={account ? String(account.id) : null}
            options={accounts.map((a) => ({ value: String(a.id), label: a.name, description: `Solde : ${formatAmount(a.balance ?? '0', a.effective_currency)}` }))}
            onChange={setAccountId}
          />
          <AmountField label="Montant" value={amount} onChangeText={setAmount} placeholder="0" suffix={account?.effective_currency} />
          {acts.length > 1 ? (
            <PickerField label="Activité" value={activity ? String(activity.id) : null} options={acts.map((a) => ({ value: String(a.id), label: a.name }))} onChange={setActivityId} />
          ) : null}
          <TextField label="Note (facultatif)" value={note} onChangeText={setNote} placeholder={copy.placeholder} />
        </Card>
        {error ? <Alert message={error} /> : null}
        <Button label={copy.button} onPress={onSubmit} loading={create.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.lg },
  help: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
});
