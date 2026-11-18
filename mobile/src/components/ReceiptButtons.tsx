import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { downloadWebFile, shareWebFile } from '@/api/exports';
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
    const isImage = ready.type === 'image/png';
    return (
      <View style={styles.wrap}>
        <Text style={styles.readyTitle}>{isImage ? 'Image du reçu prête' : 'Reçu PDF prêt'}</Text>
        <View style={styles.row}>
          <Button
            label="Enregistrer"
            icon="download-outline"
            fullWidth={false}
            style={styles.half}
            onPress={() => {
              downloadWebFile(ready);
              setReady(null);
            }}
          />
          <Button
            label="Partager"
            icon="share-outline"
            variant="secondary"
            fullWidth={false}
            style={styles.half}
            onPress={() => {
              void shareWebFile(ready);
              setReady(null);
            }}
          />
        </View>
        {isImage && IS_IOS ? (
          <Text style={styles.note}>Pour la mettre dans Photos : Partager, puis « Enregistrer l’image ».</Text>
        ) : null}
        <Text onPress={() => setReady(null)} style={styles.back}>
          Retour
        </Text>
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

const IS_IOS =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1));

const styles = StyleSheet.create({
  readyTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  back: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.sm },
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  note: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' },
  error: { fontSize: fontSize.sm, color: colors.negative },
});
