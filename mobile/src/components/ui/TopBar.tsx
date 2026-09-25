import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, spacing } from '@/theme';

interface TopBarProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
}

export function TopBar({ title, subtitle, back, onBack, right }: TopBarProps) {
  return (
    <View style={styles.bar}>
      {back ? (
        <Pressable
          hitSlop={10}
          onPress={onBack ?? (() => router.back())}
          style={styles.iconButton}
          accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
        </Pressable>
      ) : null}
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? <View style={styles.iconButton} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1 },
  title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 1 },
});
