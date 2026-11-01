import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { API_URL, ApiError, apiRequest, getTokens } from './client';

export type ExportFile = 'pdf' | 'xlsx' | 'csv';

export interface ExportParams {
  file: ExportFile;
  start: string;
  end: string;
  activity?: number;
}

const MIME: Record<ExportFile, { mimeType: string; UTI: string }> = {
  pdf: { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' },
  xlsx: { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', UTI: 'org.openxmlformats.spreadsheetml.sheet' },
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
};

function exportName(params: ExportParams) {
  return `benef-export-${params.start}_${params.end}.${params.file}`;
}

async function exportUrl(params: ExportParams) {
  // Le téléchargement ne sait pas renouveler le jeton : un appel API léger
  // d'abord le fait si besoin (et échoue proprement hors connexion).
  await apiRequest('/auth/me/');
  const { access } = await getTokens();
  const query = new URLSearchParams({ file: params.file, start: params.start, end: params.end });
  if (params.activity !== undefined) query.set('activity', String(params.activity));
  return { url: `${API_URL}/reports/export/?${query.toString()}`, access };
}

/** Téléphone (app installée) : télécharge l'export puis ouvre le menu de
 * partage : WhatsApp, e-mail, Drive… pour l'envoyer au comptable. */
export async function shareExport(params: ExportParams) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError(0, { detail: "Le partage de fichier n'est pas disponible sur cet appareil." });
  }
  const { url, access } = await exportUrl(params);
  const target = new File(Paths.cache, exportName(params));
  if (target.exists) target.delete();
  const task = File.createDownloadTask(url, target, { headers: access ? { Authorization: `Bearer ${access}` } : {} });
  const downloaded = await task.downloadAsync();
  if (!downloaded || !downloaded.exists || downloaded.size === 0) {
    throw new ApiError(0, { detail: "Le fichier n'a pas pu être téléchargé." });
  }
  await Sharing.shareAsync(downloaded.uri, { dialogTitle: 'Envoyer l’export', ...MIME[params.file] });
}

/** Navigateur (version installée sur iPhone / Android) : 1re étape, le
 * fichier est préparé. Le partage se fait ensuite sur un 2e appui : Safari
 * n'ouvre le menu de partage que juste après un toucher de l'utilisateur,
 * pas après un téléchargement qui a pris quelques secondes. */
export async function prepareWebExport(params: ExportParams): Promise<globalThis.File> {
  const { url, access } = await exportUrl(params);
  let res: Response;
  try {
    res = await fetch(new URL(url, window.location.origin), { headers: access ? { Authorization: `Bearer ${access}` } : {} });
  } catch {
    throw new ApiError(0, { detail: 'Pas de connexion : l’export a besoin d’internet.' });
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  const blob = await res.blob();
  return new globalThis.File([blob], exportName(params), { type: MIME[params.file].mimeType });
}

/** 2e étape (dans le toucher de l'utilisateur) : menu de partage du
 * téléphone si possible, sinon téléchargement / ouverture du fichier. */
export async function shareWebFile(file: globalThis.File): Promise<void> {
  const nav = navigator as Navigator & { canShare?: (data: { files: globalThis.File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return;
    } catch (error) {
      if ((error as Error).name === 'AbortError') return; // menu fermé par l'utilisateur
    }
  }
  const href = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = href;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

export const canShareNatively = Platform.OS !== 'web';
