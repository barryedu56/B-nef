import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { AmountField } from '@/components/ui/AmountField';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { LoadingView } from '@/components/ui/QueryState';
import { PartyPicker } from '@/components/PartyPicker';
import { PickerField } from '@/components/ui/PickerField';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { useActivity } from '@/hooks/useActivities';
import { useCategories, useCreateTransaction, usePaymentMethods } from '@/hooks/useTransactions';
import { todayISO } from '@/lib/dates';
import { colors, fontSize, spacing } from '@/theme';
import type { Direction } from '@/api/types';

export default function NewTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activityId = Number(id);

  const activity = useActivity(activityId);
  const [direction, setDirection] = useState<Direction>('out');
  const categories = useCategories(activityId, direction);
  const paymentMethods = usePaymentMethods();
  const createTransaction = useCreateTransaction();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [dateChoice, setDateChoice] = useState<'today' | 'yesterday' | 'other'>('today');
  const [customDate, setCustomDate] = useState(todayISO());
  const [isCredit, setIsCredit] = useState(false);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (activity.isLoading || !activity.data) return <LoadingView />;
  const act = activity.data;
  const currency = act.currency;

  const occurredOn = dateChoice === 'today' ? todayISO() : dateChoice === 'yesterday' ? shiftedYesterday() : customDate;

  const onSubmit = async () => {
    const value = Number(amount.replace(',', '.'));
    if (!value || value <= 0) {
      setError('Indique un montant valide.');
      return;
    }
    setError(null);
    try {
      await createTransaction.mutateAsync({
        activity: activityId,
        direction,
        amount: String(value),
        currency,
        occurred_on: occurredOn,
        category: categoryId ? Number(categoryId) : null,
        payment_method: paymentMethodId ? Number(paymentMethodId) : null,
        party: isCredit && partyId ? Number(partyId) : null,
        is_credit: isCredit,
        note,
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'enregistrer.");
    }
  };

  return (
    <Screen scroll edges={['top']}>
      <TopBar title="Nouvelle opération" back onBack={() => router.back()} />
      <View style={styles.content}>
        <SegmentedControl
          options={[
            { value: 'in', label: "Entrée d'argent" },
            { value: 'out', label: 'Sortie d’argent' },
          ]}
          value={direction}
          onChange={(v) => {
            setDirection(v);
            setCategoryId(null);
            setPartyId(null);
          }}
        />

        <View style={styles.amountWrap}>
          <AmountField label="Montant" value={amount} onChangeText={setAmount} placeholder="0" suffix={currency} />
        </View>

        <PickerField
          label="Catégorie"
          value={categoryId}
          placeholder="Choisir une catégorie"
          options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
          onChange={setCategoryId}
        />

        <PickerField
          label="Moyen de paiement"
          value={paymentMethodId}
          placeholder="Choisir un moyen de paiement"
          options={(paymentMethods.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
          onChange={setPaymentMethodId}
        />

        <View style={styles.dateBlock}>
          <Text style={styles.label}>Date</Text>
          <View style={styles.chipRow}>
            <Chip label="Aujourd'hui" selected={dateChoice === 'today'} onPress={() => setDateChoice('today')} />
            <Chip label="Hier" selected={dateChoice === 'yesterday'} onPress={() => setDateChoice('yesterday')} />
            <Chip label="Autre date" selected={dateChoice === 'other'} onPress={() => setDateChoice('other')} />
          </View>
          {dateChoice === 'other' ? (
            <TextField value={customDate} onChangeText={setCustomDate} placeholder="AAAA-MM-JJ" />
          ) : null}
        </View>

        {act.has_debts ? (
          <View style={styles.creditRow}>
            <View style={styles.creditText}>
              <Text style={styles.label}>{direction === 'in' ? 'Encaissement à venir (créance)' : 'Paiement à venir (dette)'}</Text>
              <Text style={styles.hint}>
                {direction === 'in'
                  ? "L'argent n'est pas encore reçu — compte quand même dans le résultat."
                  : "L'argent n'est pas encore payé — compte quand même dans le résultat."}
              </Text>
            </View>
            <Switch value={isCredit} onValueChange={setIsCredit} trackColor={{ true: colors.accent, false: colors.borderStrong }} />
          </View>
        ) : null}

        {act.has_debts && isCredit ? (
          <PartyPicker
            label={direction === 'in' ? 'Client' : 'Fournisseur'}
            kind={direction === 'in' ? 'client' : 'supplier'}
            value={partyId}
            onChange={setPartyId}
          />
        ) : null}

        <TextField label="Note (facultatif)" value={note} onChangeText={setNote} multiline />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={direction === 'in' ? "Enregistrer l'entrée" : 'Enregistrer la sortie'}
          onPress={onSubmit}
          loading={createTransaction.isPending}
        />
      </View>
    </Screen>
  );
}

function shiftedYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  amountWrap: {},
  label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  dateBlock: { gap: spacing.sm },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  creditText: { flex: 1, gap: 2 },
  hint: { fontSize: fontSize.xs, color: colors.textTertiary },
  error: { fontSize: fontSize.sm, color: colors.negative },
});
