import { useState, type FormEvent } from 'react';

import { ApiError } from '@/api/client';
import type { Activity, Direction } from '@/api/types';
import { PartyPicker } from './PartyPicker';
import { AmountInput } from './ui/AmountInput';
import { Button } from './ui/Button';
import { Field, Select, Textarea, TextInput } from './ui/Field';
import { Modal } from './ui/Modal';
import { SegmentedControl } from './ui/SegmentedControl';
import { Switch } from './ui/Switch';
import { useCategories, useCreateTransaction, usePaymentMethods } from '@/hooks/useTransactions';
import { todayISO } from '@/lib/dates';

interface NewTransactionModalProps {
  activity: Activity;
  onClose: () => void;
  defaultDirection?: Direction;
}

export function NewTransactionModal({ activity, onClose, defaultDirection = 'out' }: NewTransactionModalProps) {
  const [direction, setDirection] = useState<Direction>(defaultDirection);
  const categories = useCategories(direction);
  const paymentMethods = usePaymentMethods();
  const createTransaction = useCreateTransaction();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [isCredit, setIsCredit] = useState(false);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!value || value <= 0) {
      setError('Indique un montant valide.');
      return;
    }
    setError(null);
    try {
      await createTransaction.mutateAsync({
        activity: activity.id,
        direction,
        amount: String(value),
        currency: activity.currency,
        occurred_on: occurredOn,
        category: categoryId ? Number(categoryId) : null,
        payment_method: paymentMethodId ? Number(paymentMethodId) : null,
        party: isCredit && partyId ? Number(partyId) : null,
        is_credit: isCredit,
        note,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer.");
    }
  };

  return (
    <Modal title="Nouvelle opération" onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SegmentedControl
          options={[
            { value: 'in', label: "Entrée d'argent" },
            { value: 'out', label: "Sortie d'argent" },
          ]}
          value={direction}
          onChange={(v) => {
            setDirection(v);
            setCategoryId(null);
            setPartyId(null);
          }}
        />

        <Field label={`Montant (${activity.currency})`}>
          <AmountInput value={amount} onChange={setAmount} placeholder="0" autoFocus />
        </Field>

        <Field label="Catégorie">
          <Select
            options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
            value={categoryId ?? ''}
            onChange={setCategoryId}
            placeholder="Choisir une catégorie"
          />
        </Field>

        <Field label="Moyen de paiement">
          <Select
            options={(paymentMethods.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
            value={paymentMethodId ?? ''}
            onChange={setPaymentMethodId}
            placeholder="Choisir un moyen de paiement"
          />
        </Field>

        <Field label="Date">
          <TextInput type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
        </Field>

        {activity.has_debts ? (
          <Switch
            checked={isCredit}
            onChange={setIsCredit}
            label={direction === 'in' ? 'Encaissement à venir (créance)' : 'Paiement à venir (dette)'}
            description="L'argent n'est pas encore échangé — compte quand même dans le résultat."
          />
        ) : null}

        {activity.has_debts && isCredit ? (
          <PartyPicker
            label={direction === 'in' ? 'Client' : 'Fournisseur'}
            kind={direction === 'in' ? 'client' : 'supplier'}
            value={partyId}
            onChange={setPartyId}
          />
        ) : null}

        <Field label="Note (facultatif)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>

        {error ? <span className="error-text">{error}</span> : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={createTransaction.isPending}>
            {direction === 'in' ? "Enregistrer l'entrée" : 'Enregistrer la sortie'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
