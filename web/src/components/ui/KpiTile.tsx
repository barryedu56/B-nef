import { AmountText } from './AmountText';

interface KpiTileProps {
  label: string;
  amount: string;
  currency: string;
  delta?: string;
  highlight?: boolean;
  sign?: 'positive' | 'negative' | 'neutral' | 'auto';
}

export function KpiTile({ label, amount, currency, delta, highlight, sign = 'auto' }: KpiTileProps) {
  return (
    <div className={['kpi-tile', highlight ? 'highlight' : ''].filter(Boolean).join(' ')}>
      <span className="kpi-label">{label}</span>
      <AmountText amount={amount} currency={currency} size={18} sign={sign} />
      {delta ? <span className="kpi-delta">{delta}</span> : null}
    </div>
  );
}
