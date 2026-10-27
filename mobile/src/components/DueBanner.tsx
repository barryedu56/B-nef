import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDueOperations, useRecurring } from '@/hooks/useRecurring';
import { syncReminders } from '@/lib/reminders';
import { colors, fontSize, radius, spacing } from '@/theme';

/** Accueil : « 2 dépenses fixes à confirmer ». Programme aussi les rappels
 * du téléphone au démarrage. */
export function DueBanner() {
  const due = useDueOperations();
  const list = useRecurring();

  useEffect(() => {
    if (list.data) void syncReminders(list.data);
  }, [list.data]);

  const count = due.data?.length ?? 0;
  if (count === 0) return null;
  const first = due.data?.[0]?.recurring.label;
  return (
    <Pressable onPress={() => router.push('/recurring')} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[styles.banner, pressed && { opacity: 0.85 }]}>
          <Ionicons name="alarm-outline" size={22} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {count} dépense{count > 1 ? 's' : ''} fixe{count > 1 ? 's' : ''} à confirmer
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {first}
              {count > 1 ? ` et ${count - 1} autre${count > 2 ? 's' : ''}` : ''} · rien n'est enregistré sans toi
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.warning} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  title: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: fontSize.xs, color: colors.textSecondary },
});
