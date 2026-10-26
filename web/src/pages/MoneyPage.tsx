import { ArrowLeftRight, Banknote, Calculator, CircleMinus, CirclePlus, Landmark, Smartphone, Wallet, type LucideIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { ApiError } from '@/api/client';
import type { AccountOverviewRow, CashCount } from '@/api/types';
import { TxnType } from '@/components/TxnType';
import { AmountInput } from '@/components/ui/AmountInput';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { PageHeader } from '@/components/layout/PageHeader';
import { useActivities } from '@/hooks/useActivities';
import { useAccountMovements, useAccountsOverview, useCashCounts, useCountCash, useTransfer } from '@/hooks/useAccounts';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { formatRelativeDate, todayISO } from '@/lib/dates';
import { formatAmount } from '@/lib/money';

type ModalKind = 'transfer' | 'contribution' | 'withdrawal' | 'count' | null;

export function accountIcon(account: { name: string; is_cash: boolean }): LucideIcon {
  if (account.is_cash) return Banknote;
  if (/banque|bank|compte/i.test(account.name)) return Landmark;
  if (/money|wave|momo|mobile|orange|mtn|free/i.test(account.name)) return Smartphone;
  return Wallet;
}

/** « Mon argent » : combien j'ai réellement, et dans quelle caisse. */
export function MoneyPage() {
  const overview = useAccountsOverview();
  const [modal, setModal] = useState<ModalKind>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [countAccount, setCountAccount] = useState<number | undefined>(undefined);

  if (overview.isLoading) return <LoadingBlock label="calcul de tes caisses" />;
  if (overview.isError || !overview.data) {
    return <ErrorBlock message="Impossible de charger tes caisses." onRetry={() => overview.refetch()} />;
  }
  const data = overview.data;
  const selected = data.accounts.find((a) => a.id === selectedId) ?? data.accounts[0];

  return (
    <>
      <PageHeader
        title="Mon argent"
        subtitle="Combien tu as réellement, et dans quelle caisse."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setModal('transfer')}>
              <ArrowLeftRight size={16} /> Transférer
            </Button>
            <Button variant="secondary" onClick={() => setModal('contribution')}>
              <CirclePlus size={16} /> Apport
            </Button>
            <Button variant="secondary" onClick={() => setModal('withdrawal')}>
              <CircleMinus size={16} /> Retrait
            </Button>
            <Button
              onClick={() => {
                setCountAccount(selected?.id);
                setModal('count');
              }}>
              <Calculator size={16} /> Vérifier une caisse
            </Button>
          </div>
        }
      />
      <div className="content">
        <div className="kpi-tile highlight" style={{ padding: '22px 26px' }}>
          <div className="kpi-head">
            <span className="kpi-icon">
              <Wallet size={20} />
            </span>
            <span className="kpi-label">Tout ton argent aujourd'hui</span>
          </div>
          <AmountText amount={data.total} currency={data.currency} size={34} sign="neutral" />
          <span className="kpi-label">
            {data.accounts.length} caisse{data.accounts.length > 1 ? 's' : ''} · au taux de change du jour
          </span>
        </div>

        <div className="activity-grid">
          {data.accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              selected={account.id === selected?.id}
              onSelect={() => setSelectedId(account.id)}
              onCount={() => {
                setCountAccount(account.id);
                setModal('count');
              }}
            />
          ))}
        </div>

        {selected ? <AccountDetail account={selected} /> : null}

        <span className="field-hint">
          Chaque vente, dépense ou achat payé va dans la caisse choisie comme moyen de paiement (Espèces par défaut).
          Apports, retraits et transferts font bouger l'argent sans changer ton bénéfice. Ajoute ou renomme tes caisses
          dans Paramètres → Moyens de paiement.
        </span>
      </div>

      {modal === 'transfer' ? <TransferModal accounts={data.accounts} onClose={() => setModal(null)} /> : null}
      {modal === 'contribution' || modal === 'withdrawal' ? (
        <PersonalModal kind={modal} accounts={data.accounts} onClose={() => setModal(null)} />
      ) : null}
      {modal === 'count' ? <CountModal accounts={data.accounts} initialAccount={countAccount} onClose={() => setModal(null)} /> : null}
    </>
  );
}

function AccountCard({
  account,
  selected,
  onSelect,
  onCount,
}: {
  account: AccountOverviewRow;
  selected: boolean;
  onSelect: () => void;
  onCount: () => void;
}) {
  const Icon = accountIcon(account);
  const negative = Number(account.balance) < 0;
  return (
    <div
      className="activity-card"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === 'Enter' ? onSelect() : undefined)}
      style={selected ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px rgba(79,70,229,0.12)' } : undefined}>
      <div className="activity-card-head">
        <span className="row-icon" style={{ width: 42, height: 42, borderRadius: 12 }}>
          <Icon size={20} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="activity-card-name">{account.name}</div>
          <div className="activity-card-type" style={negative ? { color: 'var(--negative)' } : undefined}>
            {negative
              ? 'Solde négatif : une opération est peut-être dans la mauvaise caisse'
              : account.last_count
                ? `Vérifiée ${formatRelativeDate(account.last_count.at.slice(0, 10)).toLowerCase()}`
                : 'Jamais vérifiée'}
          </div>
        </div>
      </div>
      <AmountText amount={account.balance ?? '0'} currency={account.effective_currency} size={24} sign={negative ? 'negative' : 'neutral'} />
      <div>
        <Button
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onCount();
          }}>
          <Calculator size={15} /> Vérifier
        </Button>
      </div>
    </div>
  );
}

function AccountDetail({ account }: { account: AccountOverviewRow }) {
  const movements = useAccountMovements(account.id);
  const counts = useCashCounts(account.id);
  const activities = useActivities();
  const activityName = new Map((activities.data ?? []).map((a) => [a.id, a.name]));
  const rows = movements.data?.results ?? [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 20, alignItems: 'flex-start' }}>
      <Card>
        <span className="card-title">Mouvements · {account.name}</span>
        {movements.isLoading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="Aucun mouvement" description="Les opérations payées avec cette caisse apparaîtront ici." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opération</th>
                  <th>Activité</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 40).map((txn) => (
                  <tr key={txn.id} style={txn.is_voided ? { opacity: 0.5 } : undefined}>
                    <td>{formatRelativeDate(txn.occurred_on)}</td>
                    <td>
                      <TxnType kind={txn.kind} direction={txn.direction} extra={txn.is_voided ? <span className="badge" style={{ marginLeft: 6 }}>annulée</span> : null} />
                    </td>
                    <td>{activityName.get(txn.activity) ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <AmountText amount={txn.amount} currency={txn.currency} size={13} sign={txn.direction === 'in' ? 'positive' : 'negative'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card>
        <span className="card-title">Vérifications</span>
        {(counts.data ?? []).length === 0 ? (
          <EmptyState title="Jamais vérifiée" description="Compte l'argent réel de cette caisse pour vérifier que tout est juste." />
        ) : (
          (counts.data ?? []).slice(0, 8).map((c: CashCount) => {
            const diff = Number(c.difference);
            return (
              <div key={c.id} className="switch-row" style={{ padding: '8px 0' }}>
                <span style={{ fontSize: 12.5 }}>
                  {formatRelativeDate(c.created_at.slice(0, 10))}
                  <span style={{ color: 'var(--text-tertiary)' }}> · compté {formatAmount(c.counted, c.currency)}</span>
                </span>
                <span className={`badge ${diff === 0 ? 'positive' : diff < 0 ? 'negative' : 'warning'}`}>
                  {diff === 0 ? 'Juste' : `${diff > 0 ? '+' : ''}${formatAmount(c.difference, c.currency)}`}
                </span>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

function useSortedActivities() {
  const activities = useActivities();
  // Activités avec stock d'abord : c'est là que circule l'argent du commerce.
  return [...(activities.data ?? [])].sort((x, y) => Number(y.has_inventory) - Number(x.has_inventory));
}

const accountOptions = (accounts: AccountOverviewRow[]) =>
  accounts.map((a) => ({ value: String(a.id), label: `${a.name} — ${formatAmount(a.balance ?? '0', a.effective_currency)}` }));

function TransferModal({ accounts, onClose }: { accounts: AccountOverviewRow[]; onClose: () => void }) {
  const acts = useSortedActivities();
  const transfer = useTransfer();
  const [fromId, setFromId] = useState(accounts[0] ? String(accounts[0].id) : '');
  const [toId, setToId] = useState(accounts[1] ? String(accounts[1].id) : '');
  const [fromActivity, setFromActivity] = useState('');
  const [toActivity, setToActivity] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const from = accounts.find((a) => String(a.id) === fromId);
  const fromAct = fromActivity || (acts[0] ? String(acts[0].id) : '');
  const toAct = toActivity || fromAct;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!value || value <= 0) return setError('Indique le montant à transférer.');
    if (fromId === toId && fromAct === toAct) return setError('Choisis une autre caisse ou une autre activité de destination.');
    setError(null);
    try {
      await transfer.mutateAsync({
        from_account: Number(fromId),
        to_account: Number(toId),
        from_activity: Number(fromAct),
        to_activity: Number(toAct),
        amount: String(value),
        currency: from?.effective_currency,
        note: note.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Transfert impossible.');
    }
  };

  return (
    <Modal title="Transférer de l'argent" onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-grid" style={{ gap: 12 }}>
          <Field label="Depuis la caisse">
            <Select options={accountOptions(accounts)} value={fromId} onChange={setFromId} />
          </Field>
          <Field label="Vers la caisse">
            <Select options={accountOptions(accounts)} value={toId} onChange={setToId} />
          </Field>
        </div>
        <Field label={`Montant${from ? ` (${from.effective_currency})` : ''}`}>
          <AmountInput value={amount} onChange={setAmount} placeholder="0" autoFocus />
        </Field>
        {acts.length > 1 ? (
          <div className="form-grid" style={{ gap: 12 }}>
            <Field label="Activité qui donne">
              <Select options={acts.map((a) => ({ value: String(a.id), label: a.name }))} value={fromAct} onChange={setFromActivity} />
            </Field>
            <Field label="Activité qui reçoit">
              <Select options={acts.map((a) => ({ value: String(a.id), label: a.name }))} value={toAct} onChange={setToActivity} />
            </Field>
          </div>
        ) : null}
        <Field label="Note (facultatif)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. dépôt à la banque" />
        </Field>
        <span className="field-hint">Un transfert n'est ni un gain ni une dépense : ton bénéfice ne change pas.</span>
        {error ? <div className="alert error">{error}</div> : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={transfer.isPending}>
            Transférer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const PERSONAL_COPY = {
  contribution: {
    title: 'Apport personnel',
    help: "De l'argent que tu ajoutes de ta poche : il entre dans la caisse, mais ce n'est pas une vente — ton bénéfice ne change pas.",
    button: "Enregistrer l'apport",
  },
  withdrawal: {
    title: 'Retrait personnel',
    help: "De l'argent que tu prends pour toi : il sort de la caisse, mais ce n'est pas une dépense de l'activité — ton bénéfice ne change pas.",
    button: 'Enregistrer le retrait',
  },
};

function PersonalModal({
  kind,
  accounts,
  onClose,
}: {
  kind: 'contribution' | 'withdrawal';
  accounts: AccountOverviewRow[];
  onClose: () => void;
}) {
  const copy = PERSONAL_COPY[kind];
  const acts = useSortedActivities();
  const create = useCreateTransaction();
  const [accountId, setAccountId] = useState(accounts[0] ? String(accounts[0].id) : '');
  const [activityId, setActivityId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const account = accounts.find((a) => String(a.id) === accountId);
  const activity = activityId || (acts[0] ? String(acts[0].id) : '');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!value || value <= 0) return setError('Indique le montant.');
    if (!account || !activity) return setError('Choisis la caisse et l’activité.');
    setError(null);
    try {
      await create.mutateAsync({
        activity: Number(activity),
        direction: kind === 'contribution' ? 'in' : 'out',
        kind,
        amount: String(value),
        currency: account.effective_currency,
        occurred_on: todayISO(),
        payment_method: account.id,
        note: note.trim() || copy.title,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer.");
    }
  };

  return (
    <Modal title={copy.title} onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span className="field-hint">{copy.help}</span>
        <Field label="Caisse">
          <Select options={accountOptions(accounts)} value={accountId} onChange={setAccountId} />
        </Field>
        <Field label={`Montant${account ? ` (${account.effective_currency})` : ''}`}>
          <AmountInput value={amount} onChange={setAmount} placeholder="0" autoFocus />
        </Field>
        {acts.length > 1 ? (
          <Field label="Activité">
            <Select options={acts.map((a) => ({ value: String(a.id), label: a.name }))} value={activity} onChange={setActivityId} />
          </Field>
        ) : null}
        <Field label="Note (facultatif)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error ? <div className="alert error">{error}</div> : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending}>
            {copy.button}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CountModal({
  accounts,
  initialAccount,
  onClose,
}: {
  accounts: AccountOverviewRow[];
  initialAccount?: number;
  onClose: () => void;
}) {
  const acts = useSortedActivities();
  const countCash = useCountCash();
  const [accountId, setAccountId] = useState(String(initialAccount ?? accounts[0]?.id ?? ''));
  const [activityId, setActivityId] = useState('');
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CashCount | null>(null);
  const account = accounts.find((a) => String(a.id) === accountId);
  const activity = activityId || (acts[0] ? String(acts[0].id) : '');
  const expected = Number(account?.balance ?? 0);
  const countedValue = counted ? Number(counted.replace(',', '.')) : null;
  const diff = countedValue !== null && !Number.isNaN(countedValue) ? countedValue - expected : null;
  const currency = account?.effective_currency ?? '';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!account || countedValue === null || Number.isNaN(countedValue) || countedValue < 0) {
      return setError('Indique le montant que tu as compté.');
    }
    setError(null);
    try {
      setResult(
        await countCash.mutateAsync({ accountId: account.id, input: { counted: String(countedValue), activity: Number(activity), note: note.trim() } })
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Vérification impossible.');
    }
  };

  if (result) {
    const d = Number(result.difference);
    return (
      <Modal title="Vérification enregistrée" onClose={onClose}>
        <div className={`alert ${d === 0 ? 'success' : 'info'}`}>
          {d === 0
            ? 'Ta caisse est juste : le montant compté correspond au solde.'
            : `Écart de ${formatAmount(Math.abs(d), result.currency)} (${d < 0 ? 'manque' : 'surplus'}). Le solde a été aligné sur ce que tu as compté, et l'écart compte dans tes ${d < 0 ? 'charges' : 'gains'}.`}
        </div>
        <div className="form-actions">
          <Button onClick={onClose}>Terminé</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Vérifier une caisse" onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span className="field-hint">Compte l'argent réellement présent (tiroir, solde Orange Money, relevé de banque) et saisis-le.</span>
        <Field label="Caisse">
          <Select
            options={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
            value={accountId}
            onChange={(v) => {
              setAccountId(v);
              setCounted('');
            }}
          />
        </Field>
        <div className="card card-muted" style={{ padding: 14 }}>
          <div className="kpi-label">Selon Bénef, tu devrais avoir</div>
          <AmountText amount={String(expected)} currency={currency} size={20} sign="neutral" />
        </div>
        <Field label={`Montant compté (${currency})`}>
          <AmountInput value={counted} onChange={setCounted} placeholder="0" autoFocus />
        </Field>
        {diff !== null ? (
          <strong style={{ color: diff === 0 ? 'var(--positive)' : diff < 0 ? 'var(--negative)' : 'var(--warning)' }}>
            {diff === 0 ? '✓ Caisse juste' : `${diff < 0 ? 'Manque' : 'Surplus'} : ${formatAmount(Math.abs(diff), currency)}`}
          </strong>
        ) : null}
        {acts.length > 1 && diff !== null && diff !== 0 ? (
          <Field label="Activité concernée par l'écart">
            <Select options={acts.map((a) => ({ value: String(a.id), label: a.name }))} value={activity} onChange={setActivityId} />
          </Field>
        ) : null}
        <Field label="Note (facultatif)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. erreur de monnaie" />
        </Field>
        {error ? <div className="alert error">{error}</div> : null}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={countCash.isPending}>
            Enregistrer la vérification
          </Button>
        </div>
      </form>
    </Modal>
  );
}
