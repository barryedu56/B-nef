import { router } from 'expo-router';
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
import { useAccountsOverview, useTransfer } from '@/hooks/useAccounts';
import { formatAmount } from '@/lib/money';
import { colors, fontSize, spacing } from '@/theme';

/** Déplacer de l'argent : d'une caisse à l'autre (ex. déposer des espèces à
 * la banque) et/ou d'une activité à l'autre (ex. la boutique paie la maison). */
export default function TransferScreen() {
  const overview = useAccountsOverview();
  const activities = useActivities();
  const transfer = useTransfer();
  const accounts = overview.data?.accounts ?? [];
  // Activités avec stock d'abord : c'est là que circule l'argent du commerce.
  const acts = [...(activities.data ?? [])].sort((x, y) => Number(y.has_inventory) - Number(x.has_inventory));

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [fromActivity, setFromActivity] = useState('');
  const [toActivity, setToActivity] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [fee, setFee] = useState('');
  const [error, setError] = useState<string | null>(null);

  const from = accounts.find((a) => String(a.id) === fromId) ?? accounts[0];
  const to = accounts.find((a) => String(a.id) === toId) ?? accounts.find((a) => a.id !== from?.id);
  const fromAct = fromActivity || (acts[0] ? String(acts[0].id) : '');
  const toAct = toActivity || fromAct;
  const accountOptions = accounts.map((a) => ({
    value: String(a.id),
    label: a.name,
    description: `Solde : ${formatAmount(a.balance ?? '0', a.effective_currency)}`,
  }));
  const activityOptions = acts.map((a) => ({ value: String(a.id), label: a.name }));

  const onSubmit = async () => {
    const value = Number(amount.replace(',', '.'));
    if (!from || !to || !fromAct) {
      setError('Choisis les caisses et l’activité.');
      return;
    }
    if (!value || value <= 0) {
      setError('Indique le montant à transférer.');
      return;
    }
    if (from.id === to.id && fromAct === toAct) {
      setError('Choisis une autre caisse ou une autre activité de destination.');
      return;
    }
    setError(null);
    try {
      await transfer.mutateAsync({
        from_account: from.id,
        to_account: to.id,
        from_activity: Number(fromAct),
        to_activity: Number(toAct),
        amount: String(value),
        currency: from.effective_currency,
        note: note.trim(),
        fee: Number(fee.replace(',', '.')) > 0 ? String(Number(fee.replace(',', '.'))) : undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Transfert impossible.');
    }
  };

  return (
    <Screen edges={['top']}>
      <TopBar title="Transférer de l'argent" back />
      <View style={styles.content}>
        <Card style={styles.card}>
          <PickerField label="Depuis la caisse" value={from ? String(from.id) : null} options={accountOptions} onChange={setFromId} />
          <PickerField label="Vers la caisse" value={to ? String(to.id) : null} options={accountOptions} onChange={setToId} />
          <AmountField label="Montant qui arrive" value={amount} onChangeText={setAmount} placeholder="0" suffix={from?.effective_currency} />
          <AmountField
            label="Frais de transfert (facultatif)"
            value={fee}
            onChangeText={setFee}
            placeholder="0"
            suffix={from?.effective_currency}
            hint={`Payés en plus par ${from?.name ?? 'la caisse de départ'}. Comptés comme une dépense.`}
          />
          {acts.length > 1 ? (
            <>
              <PickerField label="Activité qui donne" value={fromAct} options={activityOptions} onChange={setFromActivity} />
              <PickerField label="Activité qui reçoit" value={toAct} options={activityOptions} onChange={setToActivity} />
            </>
          ) : null}
          <TextField label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="ex. dépôt à la banque" />
        </Card>
        <Text style={styles.help}>
          Un transfert n'est ni un gain ni une dépense : seule la répartition de ton argent bouge. Seuls les frais comptent comme une
          dépense, pour l'activité qui envoie.
        </Text>
        {error ? <Alert message={error} /> : null}
        <Button label="Transférer" icon="swap-horizontal-outline" onPress={onSubmit} loading={transfer.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.lg },
  help: { fontSize: fontSize.xs, color: colors.textTertiary, lineHeight: 17 },
});
