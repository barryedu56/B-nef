import { useState } from 'react';

import { ApiError } from '@/api/client';
import type { Transaction } from '@/api/types';
import { AmountInput } from './ui/AmountInput';
import { Button } from './ui/Button';
import { Field, Select } from './ui/Field';
import { usePaymentMethods, useSettleTransaction } from '@/hooks/useTransactions';
import { formatAmount } from '@/lib/money';

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
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const remaining = Number(txn.remaining_amount);

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
        id: txn.id,
        input: { amount: String(value), payment_method: paymentMethodId ? Number(paymentMethodId) : null },
      });
      onDone?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer ce règlement.");
    }
  };

  return (
    <div className="card card-muted" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
        Reste dû : {formatAmount(txn.remaining_amount, txn.currency)}
      </span>
      <Field label="Montant réglé maintenant">
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="Moyen de paiement (facultatif)">
        <Select
          options={(paymentMethods.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
          value={paymentMethodId}
          onChange={setPaymentMethodId}
          placeholder="Aucun"
        />
      </Field>
      {error ? <span className="error-text">{error}</span> : null}
      <div className="form-actions">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Retour
          </Button>
        ) : null}
        <Button onClick={onConfirm} loading={settle.isPending}>
          Confirmer le règlement
        </Button>
      </div>
    </div>
  );
}
