import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { Direction, PartyKind } from '@/api/types';
import { AmountField } from '@/components/ui/AmountField';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PhoneField } from '@/components/ui/PhoneField';
import { PickerField } from '@/components/ui/PickerField';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { TopBar } from '@/components/ui/TopBar';
import { useActivities } from '@/hooks/useActivities';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { useCreateParty } from '@/hooks/useParties';
import { todayISO } from '@/lib/dates';
import { isValidGuineaPhone } from '@/lib/phone';
import { colors, fontSize, radius, spacing } from '@/theme';

const KIND_OPTIONS: { value: PartyKind; label: string }[] = [
  { value: 'client', label: 'Client' },
  { value: 'supplier', label: 'Fournisseur' },
  { value: 'both', label: 'Client et fournisseur' },
];

export default function NewPartyScreen() {
  const createParty = useCreateParty();
  const createTransaction = useCreateTransaction();
  const activities = useActivities();
  const debtActivities = (activities.data ?? []).filter((a) => a.has_debts);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [kind, setKind] = useState<PartyKind>('client');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [hasOpeningBalance, setHasOpeningBalance] = useState(false);
  const [balanceDirection, setBalanceDirection] = useState<Direction>('in');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceActivityId, setBalanceActivityId] = useState<string | null>(
    debtActivities[0] ? String(debtActivities[0].id) : null,
  );
  const [dateChoice, setDateChoice] = useState<'today' | 'other'>('today');
  const [customDate, setCustomDate] = useState(todayISO());

  const onSubmit = async () => {
    if (!name.trim()) {
      setError('Donne un nom à ce tiers.');
      return;
    }
    if (phone && !isValidGuineaPhone(phone)) {
      setError('Numéro invalide : 9 chiffres, en commençant par 61, 62, 65 ou 66.');
      return;
    }
    let balanceValue = 0;
    if (hasOpeningBalance) {
      balanceValue = Number(balanceAmount.replace(',', '.'));
      if (!balanceValue || balanceValue <= 0) {
        setError('Indique le montant de la créance ou de la dette de départ.');
        return;
      }
      if (!balanceActivityId) {
        setError('Choisis à quelle activité rattacher ce solde.');
        return;
      }
    }
    setError(null);
    try {
      const party = await createParty.mutateAsync({ name: name.trim(), phone: phone.trim(), kind, note: note.trim() });
      if (hasOpeningBalance && balanceActivityId) {
        const activity = debtActivities.find((a) => String(a.id) === balanceActivityId);
        if (activity) {
          await createTransaction.mutateAsync({
            activity: activity.id,
            direction: balanceDirection,
            amount: String(balanceValue),
            currency: activity.currency,
            occurred_on: dateChoice === 'today' ? todayISO() : customDate,
            kind: 'opening_balance',
            is_credit: true,
            party: party.id,
            note: 'Solde initial (report)',
          });
        }
      }
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible de créer ce tiers.');
    }
  };

  const saving = createParty.isPending || createTransaction.isPending;

  return (
    <Screen scroll edges={['top']}>
      <TopBar title="Nouveau tiers" back />
      <View style={styles.content}>
        <TextField label="Nom" value={name} onChangeText={setName} placeholder="ex. Fatou Ndiaye" />
        <PhoneField value={phone} onChangeText={setPhone} />
        <PickerField label="Type" value={kind} options={KIND_OPTIONS} onChange={(v) => setKind(v as PartyKind)} />
        <TextField label="Note (facultatif)" value={note} onChangeText={setNote} multiline />

        {debtActivities.length > 0 ? (
          <View style={styles.balanceBlock}>
            <View style={styles.balanceHeader}>
              <View style={styles.balanceText}>
                <Text style={styles.label}>Ce tiers a-t-il déjà un solde ?</Text>
                <Text style={styles.hint}>
                  Une créance ou une dette qui existait déjà avant d'utiliser l'appli (elle ne comptera pas dans le
                  chiffre d'affaires ni les charges — seulement dans le solde du tiers, jusqu'à son règlement).
                </Text>
              </View>
              <Switch
                value={hasOpeningBalance}
                onValueChange={setHasOpeningBalance}
                trackColor={{ true: colors.accent, false: colors.borderStrong }}
              />
            </View>

            {hasOpeningBalance ? (
              <View style={styles.balanceForm}>
                <SegmentedControl
                  options={[
                    { value: 'in', label: 'Il/elle me doit' },
                    { value: 'out', label: 'Je lui dois' },
                  ]}
                  value={balanceDirection}
                  onChange={setBalanceDirection}
                />

                <PickerField
                  label="Activité concernée"
                  value={balanceActivityId}
                  placeholder="Choisir une activité"
                  options={debtActivities.map((a) => ({ value: String(a.id), label: a.name }))}
                  onChange={setBalanceActivityId}
                />

                <AmountField
                  label="Montant"
                  value={balanceAmount}
                  onChangeText={setBalanceAmount}
                  placeholder="0"
                  suffix={debtActivities.find((a) => String(a.id) === balanceActivityId)?.currency}
                />

                <View style={styles.dateBlock}>
                  <Text style={styles.label}>Date de ce solde</Text>
                  <View style={styles.chipRow}>
                    <Chip label="Aujourd'hui" selected={dateChoice === 'today'} onPress={() => setDateChoice('today')} />
                    <Chip label="Autre date" selected={dateChoice === 'other'} onPress={() => setDateChoice('other')} />
                  </View>
                  {dateChoice === 'other' ? (
                    <TextField value={customDate} onChangeText={setCustomDate} placeholder="AAAA-MM-JJ" />
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Créer le tiers" onPress={onSubmit} loading={saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  hint: { fontSize: fontSize.xs, color: colors.textTertiary },
  error: { fontSize: fontSize.sm, color: colors.negative },
  balanceBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  balanceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  balanceText: { flex: 1, gap: 2 },
  balanceForm: { gap: spacing.md },
  dateBlock: { gap: spacing.sm },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
