import { useEffect, useState } from 'react';

import { ApiError } from '@/api/client';
import { PartyPicker } from './PartyPicker';
import { SettleForm } from './SettleForm';
import { AmountText } from './ui/AmountText';
import { Button } from './ui/Button';
import { Field, Select, Textarea } from './ui/Field';
import { Modal } from './ui/Modal';
import { ErrorBlock, LoadingBlock } from './ui/QueryState';
import { useActivity } from '@/hooks/useActivities';
import { useSaleLines } from '@/hooks/useProducts';
import { useCategories, usePaymentMethods, useTransaction, useUpdateTransaction, useVoidTransaction } from '@/hooks/useTransactions';
import { formatAmount } from '@/lib/money';
import { formatLongDate } from '@/lib/dates';

interface TransactionDetailModalProps {
  transactionId: number;
  onClose: () => void;
}

export function TransactionDetailModal({ transactionId, onClose }: TransactionDetailModalProps) {
  const txn = useTransaction(transactionId);
  const activity = useActivity(txn.data?.activity);
  const categories = useCategories(txn.data?.direction);
  const paymentMethods = usePaymentMethods();
  const saleLines = useSaleLines(transactionId, txn.data?.kind === 'sale');
  const updateTxn = useUpdateTransaction();
  const voidTxn = useVoidTransaction();

  const [categoryId, setCategoryId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [partyId, setPartyId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [showSettleForm, setShowSettleForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (txn.data) {
      setCategoryId(txn.data.category ? String(txn.data.category) : '');
      setPaymentMethodId(txn.data.payment_method ? String(txn.data.payment_method) : '');
      setPartyId(txn.data.party ? String(txn.data.party) : null);
      setNote(txn.data.note);
    }
  }, [txn.data]);

  if (txn.isLoading || activity.isLoading) {
    return (
      <Modal title="Opération" onClose={onClose}>
        <LoadingBlock />
      </Modal>
    );
  }
  if (txn.isError || !txn.data) {
    return (
      <Modal title="Opération" onClose={onClose}>
        <ErrorBlock message="Opération introuvable." onRetry={() => txn.refetch()} />
      </Modal>
    );
  }

  const t = txn.data;
  const act = activity.data;
  const currency = act?.currency ?? t.currency;
  const locked = t.is_voided;

  const onSave = async () => {
    setError(null);
    setSavedMessage(null);
    try {
      await updateTxn.mutateAsync({
        id: t.id,
        patch: {
          category: categoryId ? Number(categoryId) : null,
          payment_method: paymentMethodId ? Number(paymentMethodId) : null,
          party: partyId ? Number(partyId) : null,
          note,
        },
      });
      setSavedMessage('Modifications enregistrées.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer.");
    }
  };

  const onConfirmVoid = async () => {
    setError(null);
    try {
      await voidTxn.mutateAsync({ id: t.id, reason: voidReason.trim() });
      setShowVoidForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'annuler cette opération.");
    }
  };

  return (
    <Modal title={t.kind_display} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card card-muted" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <AmountText amount={t.amount_activity} currency={currency} size={22} sign={t.direction === 'in' ? 'positive' : 'negative'} />
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{formatLongDate(t.occurred_on)}</span>
          {t.is_credit ? (
            <span style={{ fontSize: 11.5, color: 'var(--warning)', fontWeight: 600 }}>{creditStatusLabel(t)}</span>
          ) : null}
          {t.is_voided ? (
            <span style={{ fontSize: 11.5, color: 'var(--negative)', fontWeight: 600 }}>
              Annulée{t.voided_reason ? ` — ${t.voided_reason}` : ''}
            </span>
          ) : null}
        </div>

        {t.kind === 'sale' ? (
          <div className="card card-muted" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="card-title" style={{ margin: 0 }}>
              Détail de la vente
            </span>
            {saleLines.isLoading ? (
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Chargement…</span>
            ) : (saleLines.data ?? []).length === 0 ? (
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Aucun détail disponible.</span>
            ) : (
              (saleLines.data ?? []).map((line) => (
                <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{line.product_name}</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 11.5 }}>
                      {line.quantity} × {formatAmount(line.unit_price, currency)}
                      {Number(line.discount) > 0 ? ` − ${formatAmount(line.discount, currency)} de remise` : ''}
                    </div>
                  </div>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {formatAmount(line.line_total, currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : null}

        {!locked && t.is_credit && !t.is_settled ? (
          showSettleForm ? (
            <SettleForm txn={t} onDone={() => setShowSettleForm(false)} onCancel={() => setShowSettleForm(false)} />
          ) : (
            <Button onClick={() => setShowSettleForm(true)}>Marquer comme réglé</Button>
          )
        ) : null}

        <Field label="Catégorie">
          <Select
            options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
            value={categoryId}
            onChange={setCategoryId}
            placeholder="Aucune"
            disabled={locked}
          />
        </Field>
        <Field label="Moyen de paiement">
          <Select
            options={(paymentMethods.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
            value={paymentMethodId}
            onChange={setPaymentMethodId}
            placeholder="Aucun"
            disabled={locked}
          />
        </Field>
        {act?.has_debts ? (
          <PartyPicker
            label={t.direction === 'in' ? 'Client' : 'Fournisseur'}
            kind={t.direction === 'in' ? 'client' : 'supplier'}
            value={partyId}
            onChange={setPartyId}
          />
        ) : null}
        <Field label="Note">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} disabled={locked} />
        </Field>

        <span className="field-hint">
          Le montant, la devise, le sens et la date ne peuvent plus changer une fois l'opération créée — annule et
          ressaisis si besoin.
        </span>

        {error ? <span className="error-text">{error}</span> : null}
        {savedMessage ? <span style={{ fontSize: 12.5, color: 'var(--positive)' }}>{savedMessage}</span> : null}

        {!locked ? (
          <div className="form-actions" style={{ justifyContent: 'space-between' }}>
            {showVoidForm ? null : (
              <Button variant="danger" onClick={() => setShowVoidForm(true)}>
                Annuler cette opération
              </Button>
            )}
            <Button variant="secondary" onClick={onSave} loading={updateTxn.isPending}>
              Enregistrer
            </Button>
          </div>
        ) : null}

        {showVoidForm ? (
          <div className="card card-muted" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Motif (facultatif)">
              <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={2} placeholder="ex. erreur de saisie" />
            </Field>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setShowVoidForm(false)}>
                Retour
              </Button>
              <Button variant="danger" onClick={onConfirmVoid} loading={voidTxn.isPending}>
                Confirmer l'annulation
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function creditStatusLabel(t: { is_settled: boolean; settled_amount: string; remaining_amount: string; currency: string }) {
  if (t.is_settled) return 'À crédit · réglée';
  if (Number(t.settled_amount) > 0) {
    return `À crédit · réglée partiellement · reste ${formatAmount(t.remaining_amount, t.currency)}`;
  }
  return 'À crédit · non réglée';
}
