import type { Party } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { Card } from '@/components/ui/Card';
import { usePartyStatement } from '@/hooks/useParties';
import { formatRelativeDate } from '@/lib/dates';

/** Bilan d'un tiers depuis le début : côté fournisseur (acheté / payé /
 * je dois), côté client (vendu / encaissé / il me doit). */
export function PartyStatementCard({ party }: { party: Party }) {
  const statement = usePartyStatement(party.id);
  const s = statement.data;
  if (!s) return null;
  const supplier = party.kind !== 'client' || Number(s.bought) > 0;
  const client = party.kind !== 'supplier' || Number(s.sold) > 0;

  return (
    <Card style={{ marginTop: 16 }}>
      <span className="card-title">Bilan depuis le début</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
        {supplier ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="kpi-label" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Ce que je lui achète</span>
            <Line label="Total acheté" amount={s.bought} currency={s.currency} />
            <Line label="Total payé" amount={s.paid} currency={s.currency} />
            <Line label="Je lui dois encore" amount={s.owed_to_party} currency={s.currency} strong sign={Number(s.owed_to_party) > 0 ? 'negative' : 'neutral'} />
          </div>
        ) : null}
        {client ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="kpi-label" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Ce que je lui vends</span>
            <Line label="Total vendu" amount={s.sold} currency={s.currency} />
            <Line label="Total encaissé" amount={s.received} currency={s.currency} />
            <Line label="Il/elle me doit encore" amount={s.owed_by_party} currency={s.currency} strong />
          </div>
        ) : null}
      </div>
      {s.last_operation ? (
        <span className="field-hint" style={{ marginTop: 10, display: 'block' }}>
          Dernière opération : {formatRelativeDate(s.last_operation).toLowerCase()}
        </span>
      ) : null}
    </Card>
  );
}

function Line({ label, amount, currency, strong, sign = 'neutral' }: { label: string; amount: string; currency: string; strong?: boolean; sign?: 'negative' | 'neutral' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 13, color: strong ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: strong ? 700 : 400 }}>{label}</span>
      <AmountText amount={amount} currency={currency} size={strong ? 15 : 13.5} sign={sign} />
    </div>
  );
}
