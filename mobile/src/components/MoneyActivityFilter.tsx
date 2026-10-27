import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { useActivities } from '@/hooks/useActivities';
import { setMoneyActivity, useMoneyActivity } from '@/lib/moneyFilter';
import { spacing } from '@/theme';

/** Puces « Toutes les activités · Boutique… » en haut de « Mon argent ».
 * Rien ne s'affiche avec une seule activité. */
export function MoneyActivityFilter() {
  const activities = useActivities();
  const selected = useMoneyActivity();
  const acts = activities.data ?? [];
  if (acts.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip label="Toutes les activités" selected={selected === null} onPress={() => setMoneyActivity(null)} />
      {acts.map((a) => (
        <Chip key={a.id} label={a.name} selected={selected === a.id} onPress={() => setMoneyActivity(a.id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: 2 },
});
