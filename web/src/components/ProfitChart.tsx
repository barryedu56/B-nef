import { useFormatMoney } from '@/lib/money';

const MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

interface Point {
  month: string;
  net_profit: string;
  currency: string;
}

/** Bénéfice net mois par mois : le mois en cours ressort, les pertes en rouge. */
export function ProfitChart({ series }: { series: Point[] }) {
  const formatMoney = useFormatMoney();
  const max = Math.max(1, ...series.map((p) => Math.abs(Number(p.net_profit))));
  return (
    <div>
      <div className="chart-columns" role="img" aria-label="Évolution du bénéfice net par mois">
        {series.map((point, i) => {
          const value = Number(point.net_profit);
          const cls = ['chart-bar', value < 0 ? 'negative' : i === series.length - 1 ? 'positive-peak' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <div key={point.month} className="chart-column" title={`${label(point.month)} · ${formatMoney(point.net_profit, point.currency)}`}>
              <div className={cls} style={{ height: `${Math.max(3, (Math.abs(value) / max) * 100)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="chart-labels">
        {series.map((point) => (
          <span key={point.month}>{label(point.month)}</span>
        ))}
      </div>
    </div>
  );
}

function label(iso: string) {
  return MONTHS[Number(iso.slice(5, 7)) - 1] ?? iso;
}
