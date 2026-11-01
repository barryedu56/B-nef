import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { canShareNatively, prepareWebExport, shareExport, shareWebFile, type ExportFile } from '@/api/exports';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { PickerField } from '@/components/ui/PickerField';
import { Screen } from '@/components/ui/Screen';
import { TopBar } from '@/components/ui/TopBar';
import { useActivities } from '@/hooks/useActivities';
import { toISODate } from '@/lib/dates';
import { colors, fontSize, spacing } from '@/theme';

type Range = 'this-month' | 'last-month' | 'this-year' | 'last-year';

const RANGES: { value: Range; label: string }[] = [
  { value: 'this-month', label: 'Ce mois' },
  { value: 'last-month', label: 'Mois dernier' },
  { value: 'this-year', label: 'Cette année' },
  { value: 'last-year', label: "L'an dernier" },
];

function resolveRange(range: Range): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (range) {
    case 'last-month':
      return { start: toISODate(new Date(y, m - 1, 1)), end: toISODate(new Date(y, m, 0)) };
    case 'this-year':
      return { start: toISODate(new Date(y, 0, 1)), end: toISODate(new Date(y, 11, 31)) };
    case 'last-year':
      return { start: toISODate(new Date(y - 1, 0, 1)), end: toISODate(new Date(y - 1, 11, 31)) };
    default:
      return { start: toISODate(new Date(y, m, 1)), end: toISODate(new Date(y, m + 1, 0)) };
  }
}

/** Export pour le comptable (PDF, Excel ou CSV), partagé depuis le téléphone.
 * Marche aussi dans la version installée depuis le navigateur (iPhone). */
export default function ExportScreen() {
  const activities = useActivities();
  const [range, setRange] = useState<Range>('this-month');
  const [activityId, setActivityId] = useState('');
  const [busy, setBusy] = useState<ExportFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Navigateur : fichier prêt, à partager d'un 2e appui (voir prepareWebExport).
  const [ready, setReady] = useState<globalThis.File | null>(null);

  const { start, end } = resolveRange(range);

  const onExport = async (file: ExportFile) => {
    setError(null);
    setReady(null);
    setBusy(file);
    try {
      const params = { file, start, end, activity: activityId ? Number(activityId) : undefined };
      if (canShareNatively) await shareExport(params);
      else setReady(await prepareWebExport(params));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible de générer l'export.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={['top']}>
      <TopBar title="Export pour le comptable" back />
      <View style={styles.content}>
        <Text style={styles.help}>
          Le compte de résultat et toutes les opérations de la période (annulées comprises, signalées). Le PDF se lit
          sur n'importe quel téléphone ; Excel et CSV servent au comptable pour refaire ses calculs. Le fichier s'ouvre
          ensuite dans le menu de partage : WhatsApp, e-mail, Fichiers…
        </Text>
        <Card style={styles.card}>
          <Text style={styles.label}>Période</Text>
          <View style={styles.chips}>
            {RANGES.map((r) => (
              <Chip
                key={r.value}
                label={r.label}
                selected={range === r.value}
                onPress={() => {
                  setRange(r.value);
                  setReady(null);
                }}
              />
            ))}
          </View>
          <Text style={styles.dates}>
            Du {start.split('-').reverse().join('/')} au {end.split('-').reverse().join('/')}
          </Text>
          <PickerField
            label="Activité"
            value={activityId}
            options={[{ value: '', label: 'Toutes les activités' }, ...(activities.data ?? []).map((a) => ({ value: String(a.id), label: a.name }))]}
            onChange={(v) => {
              setActivityId(v);
              setReady(null);
            }}
          />
        </Card>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {ready ? (
          <Card style={styles.readyCard}>
            <Text style={styles.readyText}>
              {ready.name} est prêt ({Math.max(1, Math.round(ready.size / 1024))} Ko).
            </Text>
            <Button label="Partager ou enregistrer" icon="share-outline" onPress={() => void shareWebFile(ready)} />
          </Card>
        ) : null}
        <Button label="PDF" icon="document-text-outline" onPress={() => onExport('pdf')} loading={busy === 'pdf'} disabled={busy !== null} />
        <Button label="Excel (.xlsx)" variant="secondary" onPress={() => onExport('xlsx')} loading={busy === 'xlsx'} disabled={busy !== null} />
        <Button label="CSV" variant="secondary" onPress={() => onExport('csv')} loading={busy === 'csv'} disabled={busy !== null} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  help: { fontSize: fontSize.xs, color: colors.textSecondary },
  card: { gap: spacing.md },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dates: { fontSize: fontSize.xs, color: colors.textTertiary },
  error: { fontSize: fontSize.sm, color: colors.negative },
  readyCard: { gap: spacing.sm, backgroundColor: colors.accentSoft },
  readyText: { fontSize: fontSize.sm, color: colors.textPrimary },
});
