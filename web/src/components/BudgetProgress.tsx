import type { BudgetStatus } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';

const PERIOD_LABEL: Record<BudgetStatus['period'], string> = { week: 'semaine', month: 'mois', year: 'année' };

const COLOR: Record<BudgetStatus['status'], string> = {
  ok: 'var(--positive)',
  warning: 'var(--warning)',
  over: 'var(--negative)',
};

export function budgetTitle(b: BudgetStatus) {
  const target = b.category_name ?? 'Toutes les dépenses';
  return b.activity_name ? `${target} · ${b.activity_name}` : `${target} · toutes activités`;
}

/** Une ligne « dépensé / prévu » avec sa barre de progression. */
export function BudgetProgress({ budget, compact }: { budget: BudgetStatus; compact?: boolean }) {
  const pct = Math.min(100, Math.round(Number(budget.ratio) * 100));
  const remaining = Number(budget.remaining);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: compact ? '6px 0' : '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
        <span style={{ fontWeight: 600 }}>
          {budgetTitle(budget)}
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · par {PERIOD_LABEL[budget.period]}</span>
        </span>
        <span>
          <AmountText amount={budget.spent} currency={budget.currency} size={12.5} sign="neutral" />
          <span style={{ color: 'var(--text-tertiary)' }}> / </span>
          <AmountText amount={budget.planned} currency={budget.currency} size={12.5} sign="neutral" />
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${budgetTitle(budget)} : ${pct} % utilisé`}
        style={{ height: 6, borderRadius: 999, background: 'var(--placeholder)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: COLOR[budget.status] }} />
      </div>
      <span style={{ fontSize: 11.5, color: budget.status === 'ok' ? 'var(--text-tertiary)' : COLOR[budget.status] }}>
        {budget.status === 'over' ? (
          <>
            Dépassé de <AmountText amount={-remaining} currency={budget.currency} size={11.5} sign="neutral" />
          </>
        ) : (
          <>
            Reste <AmountText amount={remaining} currency={budget.currency} size={11.5} sign="neutral" /> ·{' '}
            {Math.round(Number(budget.ratio) * 100)} % utilisé
          </>
        )}
      </span>
    </div>
  );
}
