import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '@/api/client';
import type { Direction, PartyKind } from '@/api/types';
import { AmountInput } from '@/components/ui/AmountInput';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useActivities } from '@/hooks/useActivities';
import { useCreateParty, useParties, usePartyTotals } from '@/hooks/useParties';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { todayISO } from '@/lib/dates';
import { isValidGuineaPhone } from '@/lib/phone';

type Tab = 'all' | 'client' | 'supplier';

const KIND_OPTIONS = [
  { value: 'client' as PartyKind, label: 'Client' },
  { value: 'supplier' as PartyKind, label: 'Fournisseur' },
  { value: 'both' as PartyKind, label: 'Client et fournisseur' },
];

export function PartiesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('all');
  const parties = useParties(tab === 'all' ? undefined : tab);
  const totals = usePartyTotals();
  const [showCreate, setShowCreate] = useState(false);

  const currency = user?.base_currency ?? 'GNF';

  return (
    <>
      <PageHeader title="Tiers & dettes" actions={<Button onClick={() => setShowCreate(true)}>+ Nouveau tiers</Button>} />
      <div className="content">
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 220px))' }}>
          <div className="kpi-tile">
            <span className="kpi-label">On me doit (créances)</span>
            <AmountText amount={totals.data?.receivable ?? '0'} currency={currency} size={18} sign="neutral" />
          </div>
          <div className="kpi-tile">
            <span className="kpi-label">Je dois (dettes)</span>
            <AmountText amount={totals.data?.payable ?? '0'} currency={currency} size={18} sign="neutral" />
          </div>
        </div>

        <SegmentedControl
          options={[
            { value: 'all', label: 'Tous' },
            { value: 'client', label: 'Clients' },
            { value: 'supplier', label: 'Fournisseurs' },
          ]}
          value={tab}
          onChange={setTab}
        />

        <Card>
          {parties.isLoading ? (
            <LoadingBlock />
          ) : parties.isError ? (
            <ErrorBlock message="Impossible de charger les tiers." onRetry={() => parties.refetch()} />
          ) : (parties.data ?? []).length === 0 ? (
            <EmptyState title="Aucun tiers" actionLabel="+ Nouveau tiers" onAction={() => setShowCreate(true)} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Type</th>
                    <th>Téléphone</th>
                    <th style={{ textAlign: 'right' }}>Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {(parties.data ?? []).map((party) => (
                    <tr key={party.id} className="clickable" onClick={() => navigate(`/parties/${party.id}`)}>
                      <td style={{ fontWeight: 600 }}>{party.name}</td>
                      <td>{KIND_OPTIONS.find((o) => o.value === party.kind)?.label ?? party.kind}</td>
                      <td>{party.phone || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <AmountText amount={party.balance} currency={currency} size={12.5} sign="neutral" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <span className="field-hint">Solde positif = le tiers vous doit · solde négatif = vous lui devez.</span>
      </div>

      {showCreate ? <CreatePartyModal onClose={() => setShowCreate(false)} /> : null}
    </>
  );
}

function CreatePartyModal({ onClose }: { onClose: () => void }) {
  const createParty = useCreateParty();
  const createTransaction = useCreateTransaction();
  const activities = useActivities();
  const debtActivities = (activities.data ?? []).filter((a) => a.has_debts);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [kind, setKind] = useState<PartyKind>('client');
  const [error, setError] = useState<string | null>(null);

  const [hasOpeningBalance, setHasOpeningBalance] = useState(false);
  const [balanceDirection, setBalanceDirection] = useState<Direction>('in');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceActivityId, setBalanceActivityId] = useState<string | null>(null);
  const [balanceDate, setBalanceDate] = useState(todayISO());

  const selectedActivity = debtActivities.find((a) => String(a.id) === balanceActivityId) ?? debtActivities[0];

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Donne un nom.');
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
      if (!selectedActivity) {
        setError('Choisis à quelle activité rattacher ce solde.');
        return;
      }
    }
    setError(null);
    try {
      const party = await createParty.mutateAsync({ name: name.trim(), phone, kind });
      if (hasOpeningBalance && selectedActivity) {
        await createTransaction.mutateAsync({
          activity: selectedActivity.id,
          direction: balanceDirection,
          amount: String(balanceValue),
          currency: selectedActivity.currency,
          occurred_on: balanceDate,
          kind: 'opening_balance',
          is_credit: true,
          party: party.id,
          note: 'Solde initial (report)',
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer ce tiers.');
    }
  };

  const saving = createParty.isPending || createTransaction.isPending;

  return (
    <Modal title="Nouveau tiers" onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nom">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Téléphone (facultatif)">
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>
        <Field label="Type">
          <Select options={KIND_OPTIONS} value={kind} onChange={(v) => setKind(v as PartyKind)} />
        </Field>

        {debtActivities.length > 0 ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Switch
              checked={hasOpeningBalance}
              onChange={setHasOpeningBalance}
              label="Ce tiers a-t-il déjà un solde ?"
              description="Une créance ou une dette qui existait déjà avant d'utiliser l'appli (elle ne comptera pas dans le chiffre d'affaires ni les charges — seulement dans le solde du tiers, jusqu'à son règlement)."
            />

            {hasOpeningBalance ? (
              <>
                <SegmentedControl
                  options={[
                    { value: 'in', label: 'Il/elle me doit' },
                    { value: 'out', label: 'Je lui dois' },
                  ]}
                  value={balanceDirection}
                  onChange={setBalanceDirection}
                />

                <Field label="Activité concernée">
                  <Select
                    options={debtActivities.map((a) => ({ value: String(a.id), label: a.name }))}
                    value={balanceActivityId ?? String(debtActivities[0].id)}
                    onChange={setBalanceActivityId}
                  />
                </Field>

                <Field label={`Montant${selectedActivity ? ` (${selectedActivity.currency})` : ''}`}>
                  <AmountInput value={balanceAmount} onChange={setBalanceAmount} placeholder="0" />
                </Field>

                <Field label="Date de ce solde">
                  <TextInput type="date" value={balanceDate} onChange={(e) => setBalanceDate(e.target.value)} />
                </Field>
              </>
            ) : null}
          </div>
        ) : null}

        {error ? <span className="error-text">{error}</span> : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={saving}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
