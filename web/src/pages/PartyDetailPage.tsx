import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '@/api/client';
import type { PartyKind } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettleForm } from '@/components/SettleForm';
import { TransactionDetailModal } from '@/components/TransactionDetailModal';
import { useAuth } from '@/context/AuthContext';
import { useActivities } from '@/hooks/useActivities';
import { useParty, useUpdateParty } from '@/hooks/useParties';
import { useTransactions } from '@/hooks/useTransactions';
import { formatRelativeDate } from '@/lib/dates';
import { formatAmount } from '@/lib/money';
import { isValidGuineaPhone } from '@/lib/phone';

const KIND_LABELS: Record<string, string> = { client: 'Client', supplier: 'Fournisseur', both: 'Client et fournisseur' };
const KIND_OPTIONS = [
  { value: 'client', label: 'Client' },
  { value: 'supplier', label: 'Fournisseur' },
  { value: 'both', label: 'Client et fournisseur' },
];

export function PartyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const partyId = Number(id);
  const { user } = useAuth();

  const party = useParty(partyId);
  const transactions = useTransactions({ party: partyId, ordering: '-occurred_on' });
  const activities = useActivities();
  const updateParty = useUpdateParty(partyId);
  const [openTransactionId, setOpenTransactionId] = useState<number | null>(null);
  const [settlingId, setSettlingId] = useState<number | null>(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [kind, setKind] = useState<PartyKind>('client');
  const [note, setNote] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  if (party.isLoading) return <LoadingBlock label="chargement du tiers" />;
  if (party.isError || !party.data) return <ErrorBlock message="Tiers introuvable." onRetry={() => party.refetch()} />;

  const p = party.data;
  const currency = user?.base_currency ?? 'GNF';
  const activityById = new Map((activities.data ?? []).map((a) => [a.id, a]));
  const rows = transactions.data?.results ?? [];
  const outstanding = rows.filter((t) => t.is_credit && !t.is_settled && !t.is_voided);
  const history = rows.filter((t) => !outstanding.includes(t));

  const startEditing = () => {
    setName(p.name);
    setPhone(p.phone);
    setKind(p.kind);
    setNote(p.note);
    setEditError(null);
    setEditing(true);
  };

  const onSaveEdit = async () => {
    if (!name.trim()) {
      setEditError('Donne un nom à ce tiers.');
      return;
    }
    if (phone && !isValidGuineaPhone(phone)) {
      setEditError('Numéro invalide : 9 chiffres, en commençant par 61, 62, 65 ou 66.');
      return;
    }
    setEditError(null);
    try {
      await updateParty.mutateAsync({ name: name.trim(), phone, kind, note: note.trim() });
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Impossible d'enregistrer.");
    }
  };

  return (
    <>
      <PageHeader title={p.name} />
      <div className="content" style={{ maxWidth: 720 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="card-title">Informations</span>
            {!editing ? (
              <Button variant="secondary" onClick={startEditing}>
                Modifier
              </Button>
            ) : null}
          </div>

          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              <Field label="Nom">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </Field>
              <Field label="Téléphone (facultatif)">
                <PhoneInput value={phone} onChange={setPhone} />
              </Field>
              <Field label="Type">
                <Select options={KIND_OPTIONS} value={kind} onChange={(v) => setKind(v as PartyKind)} />
              </Field>
              <Field label="Note (facultatif)">
                <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              {editError ? <span className="error-text">{editError}</span> : null}
              <div className="form-actions">
                <Button variant="secondary" onClick={() => setEditing(false)}>
                  Annuler
                </Button>
                <Button onClick={onSaveEdit} loading={updateParty.isPending}>
                  Enregistrer
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="switch-row">
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Téléphone</span>
                <span style={{ fontSize: 12.5 }}>{p.phone || '—'}</span>
              </div>
              <div className="switch-row">
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Type</span>
                <span style={{ fontSize: 12.5 }}>{KIND_LABELS[p.kind] ?? p.kind}</span>
              </div>
              {p.note ? (
                <div className="switch-row">
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Note</span>
                  <span style={{ fontSize: 12.5 }}>{p.note}</span>
                </div>
              ) : null}
            </>
          )}
        </Card>

        <Card muted style={{ marginTop: 16 }}>
          <span className="kpi-label">{Number(p.balance) >= 0 ? 'Il/elle me doit' : 'Je lui dois'}</span>
          <div style={{ marginTop: 4 }}>
            <AmountText amount={Math.abs(Number(p.balance))} currency={currency} size={22} sign="neutral" />
          </div>
        </Card>

        <div style={{ marginTop: 16 }}>
          <span className="card-title">Opérations à régler</span>
          {transactions.isLoading ? (
            <LoadingBlock />
          ) : outstanding.length === 0 ? (
            <EmptyState title="Rien en attente" description="Toutes les opérations à crédit sont réglées." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              {outstanding.map((txn) => {
                const activity = activityById.get(txn.activity);
                const txnCurrency = activity?.currency ?? txn.currency;
                return (
                  <Card key={txn.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13.5, cursor: 'pointer' }} onClick={() => setOpenTransactionId(txn.id)}>
                          {activity?.name ?? 'Activité'} · {formatRelativeDate(txn.occurred_on)}
                        </div>
                        {Number(txn.settled_amount) > 0 ? (
                          <div style={{ fontSize: 11.5, color: 'var(--warning)', fontWeight: 600 }}>
                            Réglé {formatAmount(txn.settled_amount, txnCurrency)} sur {formatAmount(txn.amount_activity, txnCurrency)}
                          </div>
                        ) : null}
                        <AmountText
                          amount={Number(txn.settled_amount) > 0 ? txn.remaining_amount : txn.amount_activity}
                          currency={txnCurrency}
                          size={14}
                          sign={txn.direction === 'in' ? 'positive' : 'negative'}
                        />
                      </div>
                      {settlingId !== txn.id ? (
                        <Button variant="secondary" onClick={() => setSettlingId(txn.id)}>
                          Marquer réglé
                        </Button>
                      ) : null}
                    </div>
                    {settlingId === txn.id ? (
                      <SettleForm txn={txn} onDone={() => setSettlingId(null)} onCancel={() => setSettlingId(null)} />
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {history.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <span className="card-title">Historique</span>
            <Card>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Activité</th>
                      <th>Statut</th>
                      <th style={{ textAlign: 'right' }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((txn) => {
                      const activity = activityById.get(txn.activity);
                      return (
                        <tr key={txn.id} className="clickable" onClick={() => setOpenTransactionId(txn.id)}>
                          <td className="mono" style={txn.is_voided ? { opacity: 0.5 } : undefined}>
                            {formatRelativeDate(txn.occurred_on)}
                          </td>
                          <td style={txn.is_voided ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}>
                            {activity?.name ?? '—'}
                          </td>
                          <td style={{ opacity: txn.is_voided ? 0.5 : 1 }}>
                            {txn.is_voided ? 'Annulée' : txn.is_settled ? 'Réglée' : '—'}
                          </td>
                          <td style={{ textAlign: 'right', opacity: txn.is_voided ? 0.5 : 1 }}>
                            <AmountText
                              amount={txn.amount_activity}
                              currency={activity?.currency ?? 'GNF'}
                              size={12.5}
                              sign={txn.direction === 'in' ? 'positive' : 'negative'}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null}
      </div>

      {openTransactionId ? (
        <TransactionDetailModal transactionId={openTransactionId} onClose={() => setOpenTransactionId(null)} />
      ) : null}
    </>
  );
}
