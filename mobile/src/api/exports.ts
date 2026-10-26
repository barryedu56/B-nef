import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { API_URL, ApiError, apiRequest, getTokens } from './client';

export type ExportFile = 'xlsx' | 'csv';

const MIME: Record<ExportFile, { mimeType: string; UTI: string }> = {
  xlsx: { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', UTI: 'org.openxmlformats.spreadsheetml.sheet' },
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
};

/** Télécharge l'export (opérations + compte de résultat) puis ouvre le menu
 * de partage du téléphone : WhatsApp, e-mail, Drive… pour l'envoyer au
 * comptable. */
export async function shareExport(params: { file: ExportFile; start: string; end: string; activity?: number }) {
  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
    throw new ApiError(0, { detail: "Le partage de fichier n'est pas disponible ici : utilise l'app web pour télécharger l'export." });
  }
  // Le téléchargement natif ne sait pas renouveler le jeton : un appel API
  // léger d'abord le fait si besoin (et échoue proprement hors-ligne).
  await apiRequest('/auth/me/');
  const { access } = await getTokens();

  const query = new URLSearchParams({ file: params.file, start: params.start, end: params.end });
  if (params.activity !== undefined) query.set('activity', String(params.activity));

  const target = new File(Paths.cache, `benef-export-${params.start}_${params.end}.${params.file}`);
  if (target.exists) target.delete();
  const task = File.createDownloadTask(`${API_URL}/reports/export/?${query.toString()}`, target, {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });
  const downloaded = await task.downloadAsync();
  if (!downloaded || !downloaded.exists || downloaded.size === 0) {
    throw new ApiError(0, { detail: "Le fichier n'a pas pu être téléchargé." });
  }
  await Sharing.shareAsync(downloaded.uri, { dialogTitle: 'Envoyer l’export', ...MIME[params.file] });
}
