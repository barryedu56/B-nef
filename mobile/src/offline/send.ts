/** Envoi d'une opération : directement si possible, sinon mise en file
 * d'attente et résultat provisoire affiché tout de suite. */
import { onlineManager } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { apiRequest, isNetworkError } from '@/api/client';
import { enqueue, hasPendingOps, loadOutbox, type OutboxOp } from './outbox';
import { syncOutbox } from './sync';

const QUEUED = '__queued';

/** Le résultat vient-il d'une opération mise en file (pas encore sur le serveur) ? */
export function isQueued(result: unknown): boolean {
  return !!result && typeof result === 'object' && (result as Record<string, unknown>)[QUEUED] === true;
}

function containsTempId(value: unknown): boolean {
  if (typeof value === 'number') return value < 0;
  if (Array.isArray(value)) return value.some(containsTempId);
  if (value && typeof value === 'object') return Object.values(value).some(containsTempId);
  return false;
}

export interface SendRequest<T> {
  label: string;
  method: 'POST' | 'PATCH';
  path: string;
  body: object;
  activityId?: number;
  tempId?: number;
  /** Champs ajoutés seulement si l'opération a été faite sans réseau
   * (ex. `recorded_offline` pour une vente). */
  offlineExtra?: Record<string, unknown>;
  /** Ce que l'écran reçoit en attendant le vrai résultat ; met aussi à jour
   * les données affichées (stock, liste des opérations…). */
  optimistic: (op: OutboxOp) => T;
}

/** Identifiant unique de l'opération (sert d'Idempotency-Key). Dans un
 * navigateur, `crypto.randomUUID` n'existe qu'en https ou sur localhost :
 * ouverte via http://192.168…, l'app ne pouvait plus rien enregistrer. */
export function newOperationId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    const bytes = Crypto.getRandomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // UUID v4
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}

export async function sendOrQueue<T>(req: SendRequest<T>): Promise<T> {
  await loadOutbox();
  const id = newOperationId();
  let offline = !onlineManager.isOnline();
  // Une opération qui suit des opérations en attente (ou qui pointe vers un
  // élément créé hors-ligne) doit passer après elles, dans la file.
  const mustQueue = offline || hasPendingOps() || containsTempId(req.body) || containsTempId(req.path);

  if (!mustQueue) {
    try {
      return await apiRequest<T>(req.path, {
        method: req.method,
        body: req.body,
        headers: { 'Idempotency-Key': id },
      });
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      offline = true; // réseau coupé en cours d'envoi : même clé, rejouée plus tard
    }
  }

  const op: OutboxOp = {
    id,
    createdAt: new Date().toISOString(),
    label: req.label,
    method: req.method,
    path: req.path,
    body: { ...(req.body as Record<string, unknown>), ...(offline ? req.offlineExtra : {}) },
    activityId: req.activityId,
    tempId: req.tempId,
    status: 'pending',
  };
  await enqueue(op);
  const result = req.optimistic(op);
  if (onlineManager.isOnline()) void syncOutbox();
  return Object.assign(result as object, { [QUEUED]: true }) as T;
}
