import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { colors, fontSize, spacing } from '@/theme';

interface EmptyStateProps {
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'file-tray-outline', title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={32} color={colors.textTertiary} />
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" fullWidth={false} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg },
  title: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  description: { fontSize: fontSize.sm, color: colors.textTertiary, textAlign: 'center' },
  button: { marginTop: spacing.sm, paddingHorizontal: spacing.xl },
});
