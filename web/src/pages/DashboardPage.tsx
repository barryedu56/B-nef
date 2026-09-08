import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { Period } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { KpiTile } from '@/components/ui/KpiTile';
import { EmptyState, ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useActivities } from '@/hooks/useActivities';
import { useGlobalSummary } from '@/hooks/useReports';
import { useLowStockAcrossActivities } from '@/hooks/useProducts';
import { useParties } from '@/hooks/useParties';
import { useTransactions } from '@/hooks/useTransactions';
import { formatRelativeDate } from '@/lib/dates';
import { useFormatMoney } from '@/lib/money';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
];

const CURRENCY_CHOICES = ['GNF', 'XOF', 'USD', 'EUR'];

export function DashboardPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [currency, setCurrency] = useState<string | undefined>(undefined);

  const { user } = useAuth();
  const activities = useActivities();
  const summary = useGlobalSummary(period, currency);
  const lowStock = useLowStockAcrossActivities(activities.data);
  // Pas de filtre par kind ici : un tiers "both" (client et fournisseur) peut
  // très bien avoir une créance, exactement comme un tiers "client" — c'est
  // le solde (positif) qui fait foi, pas l'étiquette.
  const clients = useParties();
  const recentTransactions = useTransactions({ ordering: '-occurred_on' });
  const formatMoney = useFormatMoney();

  if (summary.isLoading) return <LoadingBlock label="calcul du tableau de bord" />;
  if (summary.isError || !summary.data) {
    return <ErrorBlock message="Impossible de charger le tableau de bord." onRetry={() => summary.refetch()} />;
  }

  const data = summary.data;
  // Les créances et les transactions individuelles restent dans la devise
  // principale réelle (amount_base) : elles ne sont pas reconverties comme
  // les agrégats du résumé, donc on ne doit pas les étiqueter avec la devise
  // d'affichage sélectionnée.
  const baseCurrency = user?.base_currency ?? data.source_currency;
  const maxSeries = Math.max(1, ...data.timeseries.map((p) => Math.abs(Number(p.net_profit))));
  const maxBreakdown = Math.max(1, ...data.by_activity.map((r) => Math.abs(Number(r.net_profit))));
  const receivables = (clients.data ?? [])
    .filter((p) => Number(p.balance) > 0)
    .sort((a, b) => Number(b.balance) - Number(a.balance))
    .slice(0, 5);
  const recent = (recentTransactions.data?.results ?? []).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        actions={
          <>
            <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
            <div className="chip-row">
              {CURRENCY_CHOICES.map((code) => (
                <Chip key={code} label={code} selected={code === (currency ?? data.currency)} onClick={() => setCurrency(code)} />
              ))}
            </div>
          </>
        }
      />

      <div className="content">
        <div className="kpi-grid">
          <KpiTile label="Chiffre d'affaires" amount={data.revenue} currency={data.currency} sign="neutral" />
          <KpiTile label="Dépenses" amount={data.expenses} currency={data.currency} sign="neutral" />
          <KpiTile label="Marge brute" amount={data.gross_margin} currency={data.currency} sign="neutral" />
          <KpiTile label="Bénéfice net" amount={data.net_profit} currency={data.currency} highlight />
          {Number(data.personal_use) > 0 ? (
            <KpiTile label="Consommé personnellement" amount={data.personal_use} currency={data.currency} sign="neutral" />
          ) : null}
          <KpiTile label="Valeur du stock" amount={data.stock_value} currency={data.currency} sign="neutral" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card>
              <span className="card-title">Évolution du bénéfice net</span>
              <div className="chart-columns">
                {data.timeseries.map((point) => (
                  <div
                    key={point.month}
                    className={['chart-bar', Number(point.net_profit) < 0 ? 'negative' : ''].filter(Boolean).join(' ')}
                    style={{ height: `${Math.max(4, (Math.abs(Number(point.net_profit)) / maxSeries) * 100)}%` }}
                    title={`${point.month} · ${formatMoney(point.net_profit, point.currency)}`}
                  />
                ))}
              </div>
            </Card>

            <Card>
              <span className="card-title">Résultat par activité</span>
              {data.by_activity.length === 0 ? (
                <EmptyState title="Aucune activité pour l’instant" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.by_activity.map((row) => (
                    <div key={row.activity_id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                        <Link to={`/activities/${row.activity_id}`}>{row.name}</Link>
                        <AmountText amount={row.net_profit} currency={row.currency} size={12.5} />
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${Math.min(100, (Math.abs(Number(row.net_profit)) / maxBreakdown) * 100)}%`,
                            background: Number(row.net_profit) < 0 ? 'var(--negative)' : 'var(--accent)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card>
              <span className="card-title">Alertes de stock</span>
              {lowStock.isLoading ? (
                <LoadingBlock />
              ) : lowStock.rows.length === 0 ? (
                <EmptyState title="Aucune alerte" description="Tous les stocks suivis sont au-dessus du seuil." />
              ) : (
                lowStock.rows.slice(0, 6).map(({ activity, product }) => (
                  <div key={product.id} className="switch-row" style={{ padding: '7px 0' }}>
                    <span style={{ fontSize: 12.5 }}>
                      {product.name} <span style={{ color: 'var(--text-tertiary)' }}>· {activity.name}</span>
                    </span>
                    <span style={{ fontSize: 12.5, color: Number(product.stock_quantity) <= 0 ? 'var(--negative)' : 'var(--warning)' }}>
                      {Number(product.stock_quantity) <= 0 ? 'Rupture' : `${product.stock_quantity} restants`}
                    </span>
                  </div>
                ))
              )}
            </Card>

            <Card>
              <span className="card-title">On me doit</span>
              {receivables.length === 0 ? (
                <EmptyState title="Aucune créance en cours" />
              ) : (
                <>
                  {receivables.map((p) => (
                    <div key={p.id} className="switch-row" style={{ padding: '7px 0' }}>
                      <span style={{ fontSize: 12.5 }}>{p.name}</span>
                      <AmountText amount={p.balance} currency={baseCurrency} size={12.5} sign="neutral" />
                    </div>
                  ))}
                  <div className="switch-row" style={{ fontWeight: 600 }}>
                    <span style={{ fontSize: 13 }}>Total créances</span>
                    <AmountText amount={data.receivable} currency={data.currency} size={13} sign="neutral" />
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="card-title" style={{ margin: 0 }}>
              Dernières transactions
            </span>
            <Link to="/transactions" style={{ fontSize: 12 }}>
              Voir tout
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState title="Aucune transaction pour l’instant" />
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
                    <tr key={txn.id}>
                      <td className="mono">{formatRelativeDate(txn.occurred_on)}</td>
                      <td>{kindLabel(txn.kind, txn.direction)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <AmountText amount={txn.amount_base} currency={baseCurrency} size={12.5} sign={txn.direction === 'in' ? 'positive' : 'negative'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function kindLabel(kind: string, direction: 'in' | 'out') {
  if (kind === 'sale') return 'Vente';
  if (kind === 'purchase') return 'Réapprovisionnement';
  if (kind === 'settlement') return 'Règlement';
  if (kind === 'adjustment') return 'Ajustement';
  if (kind === 'opening_balance') return 'Solde initial';
  if (kind === 'personal_use') return 'Consommation personnelle';
  return direction === 'in' ? 'Entrée' : 'Sortie';
}
