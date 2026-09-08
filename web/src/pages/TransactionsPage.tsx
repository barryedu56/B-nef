import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { Direction, TransactionKind } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { PageHeader } from '@/components/layout/PageHeader';
import { NewTransactionModal } from '@/components/NewTransactionModal';
import { TransactionDetailModal } from '@/components/TransactionDetailModal';
import { useActivities } from '@/hooks/useActivities';
import { useCategories, usePaymentMethods, useTransactions } from '@/hooks/useTransactions';
import { formatRelativeDate } from '@/lib/dates';

const KIND_LABELS: Record<TransactionKind, string> = {
  simple: 'Simple',
  sale: 'Vente',
  purchase: 'Réapprovisionnement',
  settlement: 'Règlement',
  adjustment: 'Ajustement',
  opening_balance: 'Solde initial',
  personal_use: 'Consommation personnelle',
};

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activities = useActivities();
  const categories = useCategories();
  const paymentMethods = usePaymentMethods();
  const [showCreate, setShowCreate] = useState(false);
  const [openTransactionId, setOpenTransactionId] = useState<number | null>(null);

  const activityFilter = searchParams.get('activity') ?? '';
  const directionFilter = (searchParams.get('direction') ?? '') as Direction | '';

  const transactions = useTransactions({
    activity: activityFilter ? Number(activityFilter) : undefined,
    direction: directionFilter || undefined,
    ordering: '-occurred_on',
  });

  const categoryById = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c.name])), [categories.data]);
  const paymentById = useMemo(() => new Map((paymentMethods.data ?? []).map((p) => [p.id, p.name])), [paymentMethods.data]);
  const activityById = useMemo(() => new Map((activities.data ?? []).map((a) => [a.id, a])), [activities.data]);

  const selectedActivity = activityFilter ? activityById.get(Number(activityFilter)) : undefined;
  const rows = transactions.data?.results ?? [];

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  return (
    <>
      <PageHeader
        title="Transactions"
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 200 }}>
              <Select
                options={[{ value: '', label: 'Toutes les activités' }, ...(activities.data ?? []).map((a) => ({ value: String(a.id), label: a.name }))]}
                value={activityFilter}
                onChange={(v) => setFilter('activity', v)}
              />
            </div>
            <div style={{ minWidth: 160 }}>
              <Select
                options={[
                  { value: '', label: 'Entrées et sorties' },
                  { value: 'in', label: 'Entrées seulement' },
                  { value: 'out', label: 'Sorties seulement' },
                ]}
                value={directionFilter}
                onChange={(v) => setFilter('direction', v)}
              />
            </div>
            <Button onClick={() => setShowCreate(true)} disabled={!selectedActivity} title={!selectedActivity ? 'Sélectionne une activité pour ajouter une opération' : undefined}>
              + Nouvelle opération
            </Button>
          </div>
        }
      />

      <div className="content">
        <Card>
          {transactions.isLoading ? (
            <LoadingBlock />
          ) : transactions.isError ? (
            <ErrorBlock message="Impossible de charger les transactions." onRetry={() => transactions.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="Aucune transaction" description="Ajuste les filtres ou ajoute une opération." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Activité</th>
                    <th>Type</th>
                    <th>Catégorie</th>
                    <th>Paiement</th>
                    <th style={{ textAlign: 'right' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((txn) => {
                    const activity = activityById.get(txn.activity);
                    const voided = txn.is_voided;
                    return (
                      <tr key={txn.id} className="clickable" onClick={() => setOpenTransactionId(txn.id)}>
                        <td className="mono" style={voided ? { opacity: 0.5 } : undefined}>
                          {formatRelativeDate(txn.occurred_on)}
                        </td>
                        <td style={voided ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}>{activity?.name ?? '—'}</td>
                        <td style={voided ? { opacity: 0.5 } : undefined}>
                          {KIND_LABELS[txn.kind]}
                          {voided ? ' · annulée' : txn.is_credit && !txn.is_settled ? ' · à crédit' : ''}
                        </td>
                        <td style={voided ? { opacity: 0.5 } : undefined}>{txn.category ? (categoryById.get(txn.category) ?? '—') : '—'}</td>
                        <td style={voided ? { opacity: 0.5 } : undefined}>{txn.payment_method ? (paymentById.get(txn.payment_method) ?? '—') : '—'}</td>
                        <td style={{ textAlign: 'right', opacity: voided ? 0.5 : 1 }}>
                          <AmountText
                            amount={txn.amount_activity}
                            currency={activity?.currency ?? txn.currency}
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
          )}
        </Card>
      </div>

      {showCreate && selectedActivity ? <NewTransactionModal activity={selectedActivity} onClose={() => setShowCreate(false)} /> : null}
      {openTransactionId ? (
        <TransactionDetailModal transactionId={openTransactionId} onClose={() => setOpenTransactionId(null)} />
      ) : null}
    </>
  );
}
