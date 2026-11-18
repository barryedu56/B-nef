import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { shareWebFile } from '@/api/exports';
import { prepareWebReceipt, shareReceipt, type ReceiptFile } from '@/api/receipts';
import { Button } from '@/components/ui/Button';
import { colors, fontSize, spacing } from '@/theme';

/** « Reçu PDF » et « Reçu en image » d'une vente. Dans le navigateur
 * (iPhone), deux appuis : préparer, puis partager — Safari n'ouvre le menu
 * de partage que juste après un toucher. */
export function ReceiptButtons({ txnId }: { txnId: number }) {
  const [busy, setBusy] = useState<ReceiptFile | null>(null);
  const [ready, setReady] = useState<globalThis.File | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (txnId < 0) {
    return <Text style={styles.note}>Le reçu sera disponible une fois la vente envoyée (connexion).</Text>;
  }

  const onPress = async (file: ReceiptFile) => {
    setError(null);
    setBusy(file);
    try {
      if (Platform.OS === 'web') setReady(await prepareWebReceipt(txnId, file));
      else await shareReceipt(txnId, file);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Le reçu n'a pas pu être créé.");
    } finally {
      setBusy(null);
    }
  };

  if (ready) {
    return (
      <View style={styles.wrap}>
        <Button
          label={ready.type === 'image/png' ? 'Partager l’image du reçu' : 'Partager le reçu PDF'}
          icon="share-outline"
          onPress={() => {
            void shareWebFile(ready);
            setReady(null);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Button
          label="Reçu PDF"
          icon="document-text-outline"
          variant="secondary"
          fullWidth={false}
          style={styles.half}
          loading={busy === 'pdf'}
          disabled={busy !== null}
          onPress={() => void onPress('pdf')}
        />
        <Button
          label="Reçu en image"
          icon="image-outline"
          variant="secondary"
          fullWidth={false}
          style={styles.half}
          loading={busy === 'png'}
          disabled={busy !== null}
          onPress={() => void onPress('png')}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  note: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' },
  error: { fontSize: fontSize.sm, color: colors.negative },
});
