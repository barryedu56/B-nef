import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius } from '@/theme';

const MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
const HEIGHT = 120;

/** Bénéfice net mois par mois : le mois en cours ressort, les pertes en rouge. */
export function ProfitChart({ series }: { series: { month: string; net_profit: string }[] }) {
  const max = Math.max(1, ...series.map((p) => Math.abs(Number(p.net_profit))));
  return (
    <View accessibilityLabel="Évolution du bénéfice net par mois">
      <View style={styles.bars}>
        {series.map((point, i) => {
          const value = Number(point.net_profit);
          const last = i === series.length - 1;
          return (
            <View key={point.month} style={styles.column}>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, (Math.abs(value) / max) * HEIGHT),
                    backgroundColor: value < 0 ? '#f87171' : last ? colors.accent : '#c7d2fe',
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {series.map((point) => (
          <Text key={point.month} style={styles.label}>
            {MONTHS[Number(point.month.slice(5, 7)) - 1] ?? ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: HEIGHT + 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', maxWidth: 34, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  labels: { flexDirection: 'row', gap: 8, paddingTop: 6 },
  label: { flex: 1, textAlign: 'center', fontSize: 10.5, color: colors.textTertiary },
});
