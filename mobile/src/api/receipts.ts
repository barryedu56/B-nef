import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { API_URL, ApiError, apiRequest, getTokens } from './client';

export type ReceiptFile = 'pdf' | 'png';

const MIME: Record<ReceiptFile, { mimeType: string; UTI: string }> = {
  pdf: { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' },
  png: { mimeType: 'image/png', UTI: 'public.png' },
};

function receiptName(txnId: number, file: ReceiptFile) {
  return `recu-benef-${txnId}.${file}`;
}

async function receiptUrl(txnId: number, file: ReceiptFile) {
  // Renouvelle le jeton si besoin (le téléchargement ne sait pas le faire).
  await apiRequest('/auth/me/');
  const { access } = await getTokens();
  return { url: `${API_URL}/transactions/${txnId}/receipt/?file=${file}`, access };
}

/** App installée : télécharge le reçu puis ouvre le menu de partage. */
export async function shareReceipt(txnId: number, file: ReceiptFile) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError(0, { detail: "Le partage n'est pas disponible sur cet appareil." });
  }
  const { url, access } = await receiptUrl(txnId, file);
  const target = new File(Paths.cache, receiptName(txnId, file));
  if (target.exists) target.delete();
  const task = File.createDownloadTask(url, target, { headers: access ? { Authorization: `Bearer ${access}` } : {} });
  const downloaded = await task.downloadAsync();
  if (!downloaded || !downloaded.exists || downloaded.size === 0) {
    throw new ApiError(0, { detail: "Le reçu n'a pas pu être téléchargé." });
  }
  await Sharing.shareAsync(downloaded.uri, { dialogTitle: 'Envoyer le reçu', ...MIME[file] });
}

/** Navigateur : 1re étape, le reçu est préparé (le partage se fait sur un
 * 2e appui, voir shareWebFile). */
export async function prepareWebReceipt(txnId: number, file: ReceiptFile): Promise<globalThis.File> {
  const { url, access } = await receiptUrl(txnId, file);
  let res: Response;
  try {
    res = await fetch(new URL(url, window.location.origin), { headers: access ? { Authorization: `Bearer ${access}` } : {} });
  } catch {
    throw new ApiError(0, { detail: 'Pas de connexion : le reçu a besoin d’internet.' });
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  const blob = await res.blob();
  return new globalThis.File([blob], receiptName(txnId, file), { type: MIME[file].mimeType });
}
