import { StyleSheet, Text, View } from 'react-native';

import type { Party } from '@/api/types';
import { AmountText } from '@/components/ui/AmountText';
import { Card } from '@/components/ui/Card';
import { usePartyStatement } from '@/hooks/useParties';
import { formatRelativeDate } from '@/lib/dates';
import { colors, fontSize, spacing } from '@/theme';

/** Bilan d'un tiers depuis le début : côté fournisseur (acheté / payé /
 * je dois), côté client (vendu / encaissé / il me doit). */
export function PartyStatementCard({ party }: { party: Party }) {
  const statement = usePartyStatement(party.id);
  const s = statement.data;
  if (!s) return null;
  const supplier = party.kind !== 'client' || Number(s.bought) > 0;
  const client = party.kind !== 'supplier' || Number(s.sold) > 0;

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Bilan depuis le début</Text>
      {supplier ? (
        <View style={styles.block}>
          <Text style={styles.side}>Ce que je lui achète</Text>
          <Line label="Total acheté" amount={s.bought} currency={s.currency} />
          <Line label="Total payé" amount={s.paid} currency={s.currency} />
          <Line label="Je lui dois encore" amount={s.owed_to_party} currency={s.currency} strong tone={Number(s.owed_to_party) > 0 ? colors.negative : undefined} />
        </View>
      ) : null}
      {client ? (
        <View style={styles.block}>
          <Text style={styles.side}>Ce que je lui vends</Text>
          <Line label="Total vendu" amount={s.sold} currency={s.currency} />
          <Line label="Total encaissé" amount={s.received} currency={s.currency} />
          <Line label="Il/elle me doit encore" amount={s.owed_by_party} currency={s.currency} strong tone={Number(s.owed_by_party) > 0 ? colors.warning : undefined} />
        </View>
      ) : null}
      {s.last_operation ? <Text style={styles.meta}>Dernière opération : {formatRelativeDate(s.last_operation).toLowerCase()}</Text> : null}
    </Card>
  );
}

function Line({ label, amount, currency, strong, tone }: { label: string; amount: string; currency: string; strong?: boolean; tone?: string }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.label, strong && styles.strong]}>{label}</Text>
      <AmountText amount={amount} currency={currency} size={strong ? 15 : 13.5} weight={strong ? '800' : '600'} sign="neutral" style={tone ? { color: tone } : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  title: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  block: { gap: 6 },
  side: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: fontSize.sm, color: colors.textSecondary },
  strong: { fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: fontSize.xs, color: colors.textTertiary },
});
