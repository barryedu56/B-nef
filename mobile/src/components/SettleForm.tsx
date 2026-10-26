import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { Transaction } from '@/api/types';
import { AmountField } from './ui/AmountField';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { usePaymentMethods, useSettleTransaction } from '@/hooks/useTransactions';
import { formatAmount } from '@/lib/money';
import { colors, fontSize, spacing } from '@/theme';

interface SettleFormProps {
  txn: Transaction;
  onDone?: () => void;
  onCancel?: () => void;
}

/** Formulaire de règlement — total ou PARTIEL — d'une opération à crédit.
 * Le montant est pré-rempli avec ce qu'il reste à devoir, mais reste
 * modifiable : un client qui doit 100 000 peut très bien ne payer que
 * 80 000 maintenant, le reste restant dû jusqu'à un prochain règlement. */
export function SettleForm({ txn, onDone, onCancel }: SettleFormProps) {
  const paymentMethods = usePaymentMethods();
  const settle = useSettleTransaction();
  const [amount, setAmount] = useState(txn.remaining_amount);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [fee, setFee] = useState('');
  const [error, setError] = useState<string | null>(null);

  const remaining = Number(txn.remaining_amount);
  // Les frais (Orange Money, virement…) ne concernent pas les espèces.
  const method = (paymentMethods.data ?? []).find((m) => String(m.id) === paymentMethodId);
  const showFee = !!method && !method.is_cash;
  const feeValue = showFee ? Number(fee.replace(',', '.')) || 0 : 0;

  const onConfirm = async () => {
    const value = Number(amount.replace(',', '.'));
    if (!value || value <= 0) {
      setError('Indique un montant valide.');
      return;
    }
    if (value > remaining + 0.005) {
      setError(`Le montant dépasse ce qui reste dû (${formatAmount(txn.remaining_amount, txn.currency)}).`);
      return;
    }
    setError(null);
    try {
      await settle.mutateAsync({
        txn,
        input: {
          amount: String(value),
          payment_method: paymentMethodId ? Number(paymentMethodId) : null,
          fee: feeValue > 0 ? String(feeValue) : undefined,
        },
      });
      onDone?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'enregistrer ce règlement.");
    }
  };

  return (
    <View style={styles.wrap}>
      <AmountField label="Montant réglé maintenant" value={amount} onChangeText={setAmount} suffix={txn.currency} />

      <View style={styles.methodBlock}>
        <Text style={styles.label}>Moyen de paiement (facultatif)</Text>
        <View style={styles.chipRow}>
          {(paymentMethods.data ?? []).map((m) => (
            <Chip
              key={m.id}
              label={m.name}
              selected={paymentMethodId === String(m.id)}
              onPress={() => setPaymentMethodId(String(m.id))}
            />
          ))}
        </View>
      </View>

      {showFee ? (
        <AmountField
          label="Frais de transfert (facultatif)"
          value={fee}
          onChangeText={setFee}
          placeholder="0"
          suffix={txn.currency}
          hint="Ce que l'opérateur prend en plus. Compté comme une dépense."
        />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {onCancel ? (
          <Button label="Retour" variant="secondary" fullWidth={false} style={styles.actionButton} onPress={onCancel} />
        ) : null}
        <Button
          label="Confirmer le règlement"
          fullWidth={!onCancel}
          style={onCancel ? styles.actionButton : undefined}
          onPress={onConfirm}
          loading={settle.isPending}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  methodBlock: { gap: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  error: { fontSize: fontSize.sm, color: colors.negative },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1 },
});
