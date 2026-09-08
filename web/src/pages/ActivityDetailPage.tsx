import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import type { Period } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { KpiTile } from '@/components/ui/KpiTile';
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';
import { PageHeader } from '@/components/layout/PageHeader';
import { NewSaleModal } from '@/components/NewSaleModal';
import { NewTransactionModal } from '@/components/NewTransactionModal';
import { TransactionDetailModal } from '@/components/TransactionDetailModal';
import { useActivity, useUpdateActivity } from '@/hooks/useActivities';
import { useActivitySummary } from '@/hooks/useReports';
import { useTransactions } from '@/hooks/useTransactions';
import { formatPeriodLabel, formatRelativeDate, shiftAnchor, todayISO } from '@/lib/dates';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
];

export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const activityId = Number(id);
  const navigate = useNavigate();

  const [period, setPeriod] = useState<Period>('month');
  const [anchor, setAnchor] = useState(todayISO());
  const [modal, setModal] = useState<'transaction' | 'sale' | null>(null);
  const [openTransactionId, setOpenTransactionId] = useState<number | null>(null);

  const activity = useActivity(activityId);
  const summary = useActivitySummary(activityId, period, undefined, anchor);
  const transactions = useTransactions({ activity: activityId, ordering: '-occurred_on' });
  const updateActivity = useUpdateActivity(activityId);

  if (activity.isLoading || summary.isLoading) return <LoadingBlock label="chargement du tableau de bord" />;
  if (activity.isError || !activity.data) return <ErrorBlock message="Activité introuvable." onRetry={() => activity.refetch()} />;
  if (summary.isError || !summary.data) return <ErrorBlock message="Impossible de calculer le résumé." onRetry={() => summary.refetch()} />;

  const act = activity.data;
  const data = summary.data;
  const maxSeries = Math.max(1, ...data.timeseries.map((p) => Math.abs(Number(p.net_profit))));
  const recent = (transactions.data?.results ?? []).slice(0, 8);

  const toggleModule = (field: 'has_inventory' | 'has_debts' | 'has_budget') => (value: boolean) => {
    updateActivity.mutate({ [field]: value });
  };

  return (
    <>
      <PageHeader
        title={act.name}
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
            {act.has_inventory ? (
              <Button variant="secondary" onClick={() => setModal('sale')}>
                + Vente
              </Button>
            ) : null}
            <Button onClick={() => setModal('transaction')}>+ Opération</Button>
            {act.has_inventory ? (
              <Link to={`/inventory?activity=${act.id}`} className="btn btn-secondary">
                Produits & stock
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="content" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(220px, 1fr)', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="icon-btn" onClick={() => setAnchor((a) => shiftAnchor(period, a, -1))} aria-label="Période précédente">
              ‹
            </button>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{formatPeriodLabel(period, anchor)}</span>
            <button className="icon-btn" onClick={() => setAnchor((a) => shiftAnchor(period, a, 1))} aria-label="Période suivante">
              ›
            </button>
          </div>

          <div className="kpi-grid">
            <KpiTile label="Chiffre d'affaires" amount={data.revenue} currency={data.currency} sign="neutral" />
            {act.has_inventory ? <KpiTile label="Coût des ventes" amount={data.cogs} currency={data.currency} sign="negative" /> : null}
            {act.has_inventory ? <KpiTile label="Marge brute" amount={data.gross_margin} currency={data.currency} sign="neutral" /> : null}
            <KpiTile label="Charges" amount={data.expenses} currency={data.currency} sign="negative" />
            {act.has_inventory ? (
              <KpiTile label="Consommé personnellement" amount={data.personal_use} currency={data.currency} sign="neutral" />
            ) : null}
            <KpiTile label="Bénéfice net" amount={data.net_profit} currency={data.currency} highlight />
            {act.has_inventory ? <KpiTile label="Valeur du stock" amount={data.stock_value} currency={data.currency} sign="neutral" /> : null}
            <KpiTile label="Caisse" amount={data.cash_balance} currency={data.currency} sign="neutral" />
          </div>

          {data.timeseries.length > 0 ? (
            <Card>
              <span className="card-title">Évolution du bénéfice</span>
              <div className="chart-columns">
                {data.timeseries.map((point) => (
                  <div
                    key={point.month}
                    className={['chart-bar', Number(point.net_profit) < 0 ? 'negative' : ''].filter(Boolean).join(' ')}
                    style={{ height: `${Math.max(4, (Math.abs(Number(point.net_profit)) / maxSeries) * 100)}%` }}
                  />
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <span className="card-title">Dernières opérations</span>
            {recent.length === 0 ? (
              <EmptyState title="Aucune opération enregistrée" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th style={{ textAlign: 'right' }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((txn) => (
                      <tr key={txn.id} className="clickable" onClick={() => setOpenTransactionId(txn.id)}>
                        <td className="mono" style={txn.is_voided ? { opacity: 0.5 } : undefined}>
                          {formatRelativeDate(txn.occurred_on)}
                        </td>
                        <td style={txn.is_voided ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}>
                          {kindLabel(txn.kind, txn.direction)}
                          {txn.is_voided ? (
                            <span className="badge" style={{ marginLeft: 6 }}>annulée</span>
                          ) : txn.is_credit && !txn.is_settled ? (
                            <span className="badge" style={{ marginLeft: 6 }}>à crédit</span>
                          ) : null}
                        </td>
                        <td style={{ textAlign: 'right', opacity: txn.is_voided ? 0.5 : 1 }}>
                          <AmountText amount={txn.amount_activity} currency={act.currency} size={12.5} sign={txn.direction === 'in' ? 'positive' : 'negative'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <span className="card-title">Modules</span>
            <Switch
              label="Inventaire"
              description="Suivi du stock, ventes par produit"
              checked={act.has_inventory}
              onChange={toggleModule('has_inventory')}
            />
            <Switch
              label="Crédits & dettes"
              description="Clients qui doivent, fournisseurs à payer"
              checked={act.has_debts}
              onChange={toggleModule('has_debts')}
            />
            <Switch
              label="Budget & prévision"
              description="Prévu / réalisé"
              checked={act.has_budget}
              onChange={toggleModule('has_budget')}
            />
          </Card>

          <Card>
            <span className="card-title">Informations</span>
            <div className="switch-row">
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Devise</span>
              <span className="mono" style={{ fontSize: 12.5 }}>{act.currency}</span>
            </div>
            <div className="switch-row">
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Créée le</span>
              <span style={{ fontSize: 12.5 }}>{new Date(act.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
          </Card>

          <Button
            variant="danger"
            onClick={() => {
              if (confirm(`Archiver « ${act.name} » ? Ses données restent conservées.`)) {
                updateActivity.mutate({ is_archived: true }, { onSuccess: () => navigate('/activities') });
              }
            }}>
            Archiver cette activité
          </Button>
        </div>
      </div>

      {modal === 'transaction' ? <NewTransactionModal activity={act} onClose={() => setModal(null)} /> : null}
      {modal === 'sale' ? <NewSaleModal activity={act} onClose={() => setModal(null)} /> : null}
      {openTransactionId ? (
        <TransactionDetailModal transactionId={openTransactionId} onClose={() => setOpenTransactionId(null)} />
      ) : null}
    </>
  );
}

function kindLabel(kind: string, direction: 'in' | 'out') {
  if (kind === 'sale') return 'Vente';
  if (kind === 'purchase') return 'Réapprovisionnement';
  if (kind === 'settlement') return 'Règlement';
  if (kind === 'adjustment') return 'Ajustement de stock';
  if (kind === 'opening_balance') return 'Solde initial';
  if (kind === 'personal_use') return 'Consommation personnelle';
  return direction === 'in' ? 'Entrée' : 'Sortie';
}
