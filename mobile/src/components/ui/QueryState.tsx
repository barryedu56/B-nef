import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { colors, fontSize, spacing } from '@/theme';

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.accent} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.error}>{message}</Text>
      {onRetry ? <Button label="Réessayer" onPress={onRetry} variant="secondary" fullWidth={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl },
  label: { fontSize: fontSize.sm, color: colors.textTertiary },
  error: { fontSize: fontSize.sm, color: colors.negative, textAlign: 'center' },
});
