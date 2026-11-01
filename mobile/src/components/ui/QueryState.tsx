import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { useIsOnline } from '@/hooks/useOffline';
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
  const online = useIsOnline();
  // Hors connexion, « introuvable » serait faux : c'est juste pas encore
  // gardé sur le téléphone. Ça s'affichera au retour du réseau.
  if (!online) {
    return (
      <View style={styles.wrap}>
        <Ionicons name="cloud-offline-outline" size={28} color={colors.textTertiary} />
        <Text style={styles.offline}>
          Cet écran n'est pas encore disponible hors connexion. Il s'affichera dès le retour du réseau (et restera ensuite
          disponible sans internet).
        </Text>
      </View>
    );
  }
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
  offline: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
});
