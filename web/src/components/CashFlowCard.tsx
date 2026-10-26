import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import type { CashFlow, Period } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { Card } from '@/components/ui/Card';
import { ErrorBlock, LoadingBlock } from '@/components/ui/QueryState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useCashFlow } from '@/hooks/useAccounts';
import { formatPeriodLabel, shiftAnchor, todayISO } from '@/lib/dates';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
];

/** D'où vient l'argent et où il est parti, sur une période : toutes caisses,
 * puis caisse par caisse (solde au début, entré, sorti, solde à la fin). */
export function CashFlowCard() {
  const [period, setPeriod] = useState<Period>('month');
  const [anchor, setAnchor] = useState(todayISO());
  const flow = useCashFlow(period, anchor);

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <span className="card-title" style={{ margin: 0 }}>
          Entrées et sorties d'argent
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button className="icon-btn" onClick={() => setAnchor((a) => shiftAnchor(period, a, -1))} aria-label="Période précédente">
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 110, textAlign: 'center' }}>{formatPeriodLabel(period, anchor)}</span>
          <button className="icon-btn" onClick={() => setAnchor((a) => shiftAnchor(period, a, 1))} aria-label="Période suivante">
            <ChevronRight size={18} />
          </button>
          <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </div>
      </div>
      {flow.isLoading ? (
        <LoadingBlock />
      ) : flow.isError || !flow.data ? (
        <ErrorBlock message="Impossible de calculer les mouvements." onRetry={() => flow.refetch()} />
      ) : (
        <FlowContent data={flow.data} />
      )}
    </Card>
  );
}

function FlowContent({ data }: { data: CashFlow }) {
  const t = data.totals;
  const rows = (side: 'in' | 'out') =>
    Object.entries(data.labels[side])
      .filter(([key]) => Number(t[side][key]) !== 0)
      .map(([key, label]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
          <AmountText amount={t[side][key]} currency={data.currency} size={13} sign="neutral" />
        </div>
      ));
  const inRows = rows('in');
  const outRows = rows('out');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <Stat label="Au début" amount={t.opening} currency={data.currency} />
        <Stat label="Entré" amount={t.total_in} currency={data.currency} sign="positive" />
        <Stat label="Sorti" amount={t.total_out} currency={data.currency} sign="negative" />
        <Stat label="À la fin" amount={t.closing} currency={data.currency} strong />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="kpi-label" style={{ color: 'var(--positive)', fontWeight: 700 }}>D'où vient l'argent</span>
          {inRows.length ? inRows : <span className="field-hint">Aucune entrée sur la période.</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="kpi-label" style={{ color: 'var(--negative)', fontWeight: 700 }}>Où il est parti</span>
          {outRows.length ? outRows : <span className="field-hint">Aucune sortie sur la période.</span>}
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Caisse</th>
              <th style={{ textAlign: 'right' }}>Au début</th>
              <th style={{ textAlign: 'right' }}>Entré</th>
              <th style={{ textAlign: 'right' }}>Sorti</th>
              <th style={{ textAlign: 'right' }}>À la fin</th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.map((acc) => (
              <tr key={acc.id}>
                <td style={{ fontWeight: 600 }}>{acc.name}</td>
                <td style={{ textAlign: 'right' }}><AmountText amount={acc.opening} currency={acc.currency} size={12.5} sign="neutral" /></td>
                <td style={{ textAlign: 'right' }}><AmountText amount={acc.total_in} currency={acc.currency} size={12.5} sign="positive" /></td>
                <td style={{ textAlign: 'right' }}><AmountText amount={acc.total_out} currency={acc.currency} size={12.5} sign="negative" /></td>
                <td style={{ textAlign: 'right' }}><AmountText amount={acc.closing} currency={acc.currency} size={12.5} sign="neutral" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className="field-hint">
        Un transfert entre deux de tes caisses apparaît à la fois en entrée et en sortie : il ne change pas ton total.
      </span>
    </div>
  );
}

function Stat({ label, amount, currency, sign = 'neutral', strong }: { label: string; amount: string; currency: string; sign?: 'positive' | 'negative' | 'neutral'; strong?: boolean }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="kpi-label">{label}</span>
      <AmountText amount={amount} currency={currency} size={strong ? 19 : 16} sign={sign} />
    </div>
  );
}
