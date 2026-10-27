import { AlarmClock, Repeat } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { ApiError } from '@/api/client';
import { FREQUENCY_LABELS, type DueOperation, type Frequency, type RecurringOperation } from '@/api/recurring';
import { AmountInput } from '@/components/ui/AmountInput';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';
import { PageHeader } from '@/components/layout/PageHeader';
import { useActivities } from '@/hooks/useActivities';
import { useAnswerDue, useDeleteRecurring, useDueOperations, useRecurring, useSaveRecurring } from '@/hooks/useRecurring';
import { useCategories, usePaymentMethods } from '@/hooks/useTransactions';
import { formatLongDate, formatRelativeDate, todayISO } from '@/lib/dates';

const FREQUENCY_OPTIONS = (Object.keys(FREQUENCY_LABELS) as Frequency[]).map((value) => ({ value, label: FREQUENCY_LABELS[value] }));

/** Dépenses fixes (loyer, salaire, abonnement…) : à chaque échéance,
 * l'opération est préparée et attend ta confirmation — rien ne sort de la
 * caisse avant que tu confirmes. */
export function RecurringPage() {
  const list = useRecurring();
  const due = useDueOperations();
  const [editing, setEditing] = useState<RecurringOperation | 'new' | null>(null);

  const rows = list.data ?? [];
  const dueRows = due.data ?? [];

  return (
    <>
      <PageHeader
        title="Dépenses fixes"
        subtitle="Loyer, salaire, abonnement… rappelés à chaque échéance, enregistrés quand tu confirmes."
        actions={<Button onClick={() => setEditing('new')}>+ Nouvelle dépense fixe</Button>}
      />
      <div className="content">
        {dueRows.length > 0 ? (
          <>
            <span className="card-title" style={{ margin: 0 }}>
              À confirmer ({dueRows.length})
            </span>
            <div className="activity-grid">
              {dueRows.map((d) => (
                <DueCard key={`${d.recurring.id}-${d.due_date}`} due={d} waitFor={earlierDue(dueRows, d)} />
              ))}
            </div>
          </>
        ) : null}

        <Card>
          <span className="card-title">Mes dépenses fixes</span>
          {list.isLoading ? (
            <LoadingBlock />
          ) : list.isError ? (
            <ErrorBlock message="Impossible de charger les dépenses fixes." onRetry={() => list.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Aucune dépense fixe"
              description="Loyer, salaire d'un employé, abonnement… Bénef te rappelle chaque échéance et l'enregistre quand tu confirmes."
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Activité</th>
                    <th>Fréquence</th>
                    <th>Prochaine échéance</th>
                    <th style={{ textAlign: 'right' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="clickable" onClick={() => setEditing(r)} style={r.is_active ? undefined : { opacity: 0.55 }}>
                      <td style={{ fontWeight: 600 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <Repeat size={15} color="var(--accent)" />
                          {r.label}
                        </span>
                      </td>
                      <td>{r.activity_name}</td>
                      <td>{FREQUENCY_LABELS[r.frequency]}</td>
                      <td>{r.is_active ? formatRelativeDate(r.next_due) : 'En pause'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <AmountText amount={r.amount} currency={r.currency} size={13} sign={r.direction === 'out' ? 'negative' : 'positive'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <span className="field-hint">
          Le jour venu, l'opération apparaît ici et sur le tableau de bord (et un rappel arrive sur le téléphone). Tu
          confirmes — en changeant le montant ou la caisse si besoin — ou tu passes : rien n'est enregistré sans toi.
        </span>
      </div>
      {editing ? <RecurringModal item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

/** Échéance plus ancienne de la même dépense fixe, à traiter d'abord. */
function earlierDue(rows: DueOperation[], d: DueOperation): string | undefined {
  return rows.find((o) => o.recurring.id === d.recurring.id && o.due_date < d.due_date)?.due_date;
}

function DueCard({ due, waitFor }: { due: DueOperation; waitFor?: string }) {
  const r = due.recurring;
  const answer = useAnswerDue();
  const paymentMethods = usePaymentMethods();
  const [amount, setAmount] = useState(String(Number(r.amount)));
  const [methodId, setMethodId] = useState(r.payment_method ? String(r.payment_method) : '');
  const [fee, setFee] = useState('');
  const [error, setError] = useState<string | null>(null);
  const method = (paymentMethods.data ?? []).find((m) => String(m.id) === methodId);
  const showFee = !!method && !method.is_cash;

  const run = async (action: 'confirm' | 'skip') => {
    const value = Number(amount.replace(',', '.'));
    if (action === 'confirm' && (!value || value <= 0)) return setError('Indique le montant.');
    setError(null);
    try {
      await answer.mutateAsync({
        due,
        action,
        input:
          action === 'confirm'
            ? {
                amount: String(value),
                payment_method: methodId ? Number(methodId) : null,
                ...(showFee && Number(fee.replace(',', '.')) > 0 ? { fee: String(Number(fee.replace(',', '.'))) } : {}),
              }
            : {},
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible pour le moment.');
    }
  };

  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, borderColor: 'var(--warning)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <AlarmClock size={20} color="var(--warning)" />
        <div>
          <div style={{ fontWeight: 700 }}>{r.label}</div>
          <div className="field-hint">
            {r.activity_name} · échéance du {formatLongDate(due.due_date).toLowerCase()}
          </div>
        </div>
      </div>
      <Field label={`Montant (${r.currency})`}>
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <Field label={r.direction === 'out' ? 'Payé avec' : 'Reçu sur'}>
        <Select
          options={(paymentMethods.data ?? []).map((m) => ({ value: String(m.id), label: m.name }))}
          value={methodId}
          onChange={setMethodId}
          placeholder="Espèces"
        />
      </Field>
      {showFee ? (
        <Field label="Frais de transfert (facultatif)" hint={`Ce que ${method?.name ?? "l'opérateur"} prend en plus. Compté comme une dépense.`}>
          <AmountInput value={fee} onChange={setFee} placeholder="0" />
        </Field>
      ) : null}
      {error ? <span className="error-text">{error}</span> : null}
      {waitFor ? (
        <span className="field-hint">Réponds d'abord à l'échéance du {formatLongDate(waitFor).toLowerCase()}.</span>
      ) : null}
      <div className="form-actions">
        <Button variant="secondary" onClick={() => run('skip')} disabled={!!waitFor}>
          Pas cette fois
        </Button>
        <Button onClick={() => run('confirm')} loading={answer.isPending} disabled={!!waitFor}>
          Confirmer
        </Button>
      </div>
    </div>
  );
}

function firstOfNextMonth() {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

function RecurringModal({ item, onClose }: { item: RecurringOperation | null; onClose: () => void }) {
  const activities = useActivities();
  const paymentMethods = usePaymentMethods();
  const save = useSaveRecurring();
  const remove = useDeleteRecurring();
  const acts = activities.data ?? [];

  const [activityId, setActivityId] = useState(item ? String(item.activity) : '');
  const [label, setLabel] = useState(item?.label ?? '');
  const [direction, setDirection] = useState<'in' | 'out'>(item?.direction ?? 'out');
  const [amount, setAmount] = useState(item ? String(Number(item.amount)) : '');
  const [categoryId, setCategoryId] = useState(item?.category ? String(item.category) : '');
  const [methodId, setMethodId] = useState(item?.payment_method ? String(item.payment_method) : '');
  const [frequency, setFrequency] = useState<Frequency>(item?.frequency ?? 'monthly');
  const [start, setStart] = useState(item?.next_due ?? todayISO());
  const [active, setActive] = useState(item?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const categories = useCategories(direction);
  const activity = activityId || (acts[0] ? String(acts[0].id) : '');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!label.trim()) return setError('Donne un nom, ex. « Loyer boutique ».');
    if (!value || value <= 0) return setError('Indique le montant habituel.');
    setError(null);
    try {
      await save.mutateAsync({
        id: item?.id,
        input: {
          activity: Number(activity),
          label: label.trim(),
          direction,
          amount: String(value),
          category: categoryId ? Number(categoryId) : null,
          payment_method: methodId ? Number(methodId) : null,
          frequency,
          ...(!item || start !== item.next_due ? { start_date: start } : {}),
          is_active: active,
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer.");
    }
  };

  const onDelete = () => {
    if (item && confirm('Supprimer cette dépense fixe ? Les opérations déjà enregistrées restent.')) {
      remove.mutate(item.id, { onSuccess: onClose });
    }
  };

  return (
    <Modal title={item ? 'Modifier la dépense fixe' : 'Nouvelle dépense fixe'} onClose={onClose}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SegmentedControl
          options={[
            { value: 'out', label: 'Dépense' },
            { value: 'in', label: 'Entrée' },
          ]}
          value={direction}
          onChange={(v) => {
            setDirection(v);
            setCategoryId('');
          }}
        />
        <Field label="Nom">
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex. Loyer boutique" autoFocus />
        </Field>
        <div className="form-grid" style={{ gap: 12 }}>
          <Field label="Activité">
            <Select options={acts.map((a) => ({ value: String(a.id), label: a.name }))} value={activity} onChange={setActivityId} />
          </Field>
          <Field label="Montant habituel">
            <AmountInput value={amount} onChange={setAmount} placeholder="0" />
          </Field>
          <Field label="Fréquence">
            <Select options={FREQUENCY_OPTIONS} value={frequency} onChange={(v) => setFrequency(v as Frequency)} />
          </Field>
          <Field label={item ? 'Prochaine échéance' : 'Première échéance'} hint={`Ex. le 1er du mois prochain : ${formatLongDate(firstOfNextMonth())}`}>
            <TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Catégorie (facultatif)">
            <Select
              options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Aucune"
            />
          </Field>
          <Field label={direction === 'out' ? 'Payé habituellement avec' : 'Reçu habituellement sur'}>
            <Select
              options={(paymentMethods.data ?? []).map((m) => ({ value: String(m.id), label: m.name }))}
              value={methodId}
              onChange={setMethodId}
              placeholder="Espèces"
            />
          </Field>
        </div>
        {item ? <Switch label="Active" description="En pause : plus de rappel ni d'échéance à confirmer" checked={active} onChange={setActive} /> : null}
        {error ? <div className="alert error">{error}</div> : null}
        <div className="form-actions" style={{ justifyContent: item ? 'space-between' : 'flex-end' }}>
          {item ? (
            <Button type="button" variant="danger" onClick={onDelete}>
              Supprimer
            </Button>
          ) : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={save.isPending}>
              Enregistrer
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
