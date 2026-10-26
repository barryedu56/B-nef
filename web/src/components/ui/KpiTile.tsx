import type { ReactNode } from 'react';

import { AmountText } from './AmountText';

export type KpiTone = 'accent' | 'positive' | 'negative' | 'warning' | 'info';

interface KpiTileProps {
  label: string;
  amount: string;
  currency: string;
  delta?: string;
  highlight?: boolean;
  sign?: 'positive' | 'negative' | 'neutral' | 'auto';
  icon?: ReactNode;
  tone?: KpiTone;
}

export function KpiTile({ label, amount, currency, delta, highlight, sign = 'auto', icon, tone = 'accent' }: KpiTileProps) {
  return (
    <div className={['kpi-tile', highlight ? 'highlight' : ''].filter(Boolean).join(' ')}>
      <div className="kpi-head">
        {icon ? <span className={`kpi-icon tone-${tone}`}>{icon}</span> : null}
        <span className="kpi-label">{label}</span>
      </div>
      <AmountText amount={amount} currency={currency} size={22} sign={highlight ? 'neutral' : sign} />
      {delta ? <span className="kpi-delta">{delta}</span> : null}
    </div>
  );
}
