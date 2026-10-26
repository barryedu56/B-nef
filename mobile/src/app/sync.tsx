import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { TopBar } from '@/components/ui/TopBar';
import { useIsOnline, useOutbox } from '@/hooks/useOffline';
import { removeOp, updateOp, type OutboxOp } from '@/offline/outbox';
import { queryClient } from '@/offline/queryClient';
import { syncOutbox } from '@/offline/sync';
import { colors, fontSize, spacing } from '@/theme';

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Opérations saisies hors-ligne : en attente d'envoi, ou refusées par le
 * serveur (à corriger puis ressaisir, ou à supprimer). */
export default function SyncScreen() {
  const online = useIsOnline();
  const { pending, failed, syncing } = useOutbox();

  const retry = async (op: OutboxOp) => {
    await updateOp(op.id, { status: 'pending', error: undefined });
    void syncOutbox();
  };

  const discard = (op: OutboxOp) => {
    Alert.alert(
      'Supprimer cette opération ?',
      `« ${op.label} » ne sera jamais enregistrée. Les chiffres affichés seront rechargés depuis le serveur.`,
      [
        { text: 'Garder', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await removeOp(op.id);
            // retire l'affichage provisoire (stock, liste…) posé par cette opération
            void queryClient.invalidateQueries();
          },
        },
      ]
    );
  };

  return (
    <Screen edges={['top']}>
      <TopBar title="Synchronisation" back />
      <View style={styles.content}>
        <Text style={styles.status}>
          {online
            ? syncing
              ? 'En ligne · envoi en cours…'
              : 'En ligne'
            : 'Hors ligne · les opérations partiront automatiquement au retour du réseau.'}
        </Text>

        {pending.length === 0 && failed.length === 0 ? (
          <EmptyState icon="cloud-done-outline" title="Tout est synchronisé" description="Aucune opération en attente." />
        ) : null}

        {failed.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Refusées par le serveur</Text>
            <Text style={styles.help}>
              Le serveur n'a pas accepté ces opérations. Lis le motif : réessaie si le problème est réglé, sinon
              supprime-la et ressaisis-la correctement.
            </Text>
            {failed.map((op) => (
              <Card key={op.id} style={styles.card}>
                <Text style={styles.label}>{op.label}</Text>
                <Text style={styles.meta}>Saisie le {formatWhen(op.createdAt)}</Text>
                {op.error ? <Text style={styles.error}>{op.error}</Text> : null}
                <View style={styles.actions}>
                  <Button label="Réessayer" variant="secondary" onPress={() => retry(op)} style={styles.action} />
                  <Button label="Supprimer" variant="danger" onPress={() => discard(op)} style={styles.action} />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {pending.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>En attente d'envoi ({pending.length})</Text>
            {pending.map((op) => (
              <Card key={op.id} style={styles.card}>
                <Text style={styles.label}>{op.label}</Text>
                <Text style={styles.meta}>Saisie le {formatWhen(op.createdAt)}</Text>
              </Card>
            ))}
            {online ? (
              <Button label="Envoyer maintenant" onPress={() => void syncOutbox()} loading={syncing} />
            ) : null}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  status: { fontSize: fontSize.sm, color: colors.textSecondary },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  help: { fontSize: fontSize.xs, color: colors.textSecondary },
  card: { gap: 4 },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  meta: { fontSize: fontSize.xs, color: colors.textTertiary },
  error: { fontSize: fontSize.xs, color: colors.negative, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1 },
});
