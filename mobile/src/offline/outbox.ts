/** File d'attente des opérations saisies hors-ligne.
 *
 * Chaque opération garde l'identifiant (`id`) qui sert d'`Idempotency-Key` :
 * si un envoi arrive au serveur mais que la réponse se perd, le renvoi ne
 * crée pas de doublon (voir backend/apps/common/idempotency.py).
 *
 * Un tiers ou un produit créé hors-ligne reçoit un identifiant provisoire
 * négatif (`tempId`) ; une fois créé sur le serveur, ce numéro est remplacé
 * par le vrai dans toutes les opérations suivantes de la file.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'benef-outbox';

export interface OutboxOp {
  id: string;
  createdAt: string;
  /** Texte affiché à l'utilisateur, ex. « Vente — Boutique ». */
  label: string;
  method: 'POST' | 'PATCH';
  path: string;
  body: Record<string, unknown>;
  activityId?: number;
  /** Identifiant provisoire de l'élément que crée cette opération. */
  tempId?: number;
  status: 'pending' | 'failed';
  error?: string;
}

interface Persisted {
  ops: OutboxOp[];
  idMap: Record<string, number>;
  lastTempId: number;
  /** Utilisateur à qui appartient la file. */
  ownerId?: number;
}

export interface OutboxSnapshot {
  ops: OutboxOp[];
  syncing: boolean;
  loaded: boolean;
}

let state: Persisted = { ops: [], idMap: {}, lastTempId: 0 };
let snapshot: OutboxSnapshot = { ops: [], syncing: false, loaded: false };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(partial: Partial<OutboxSnapshot> = {}) {
  snapshot = { ...snapshot, ops: state.ops, ...partial };
  listeners.forEach((l) => l());
}

async function persist() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadOutbox(): Promise<void> {
  loading ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) state = { ...state, ...(JSON.parse(raw) as Persisted) };
    } catch {
      // stockage illisible : on repart d'une file vide
    }
    emit({ loaded: true });
  })();
  return loading;
}

export function subscribeOutbox(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOutboxSnapshot(): OutboxSnapshot {
  return snapshot;
}

export function setSyncing(syncing: boolean) {
  emit({ syncing });
}

export function hasPendingOps(): boolean {
  return state.ops.some((op) => op.status === 'pending');
}

/** Nouvel identifiant provisoire (négatif, jamais réutilisé). */
export async function nextTempId(): Promise<number> {
  await loadOutbox();
  state.lastTempId -= 1;
  await persist();
  return state.lastTempId;
}

export async function enqueue(op: OutboxOp) {
  await loadOutbox();
  state.ops = [...state.ops, op];
  await persist();
  emit();
}

export async function removeOp(id: string) {
  state.ops = state.ops.filter((op) => op.id !== id);
  await persist();
  emit();
}

export async function updateOp(id: string, patch: Partial<OutboxOp>) {
  state.ops = state.ops.map((op) => (op.id === id ? { ...op, ...patch } : op));
  await persist();
  emit();
}

export async function recordCreatedId(tempId: number, realId: number) {
  state.idMap = { ...state.idMap, [String(tempId)]: realId };
  await persist();
}

/** Remplace dans une opération les identifiants provisoires déjà créés sur
 * le serveur par leur vrai numéro. */
export function resolveIds(op: OutboxOp): OutboxOp {
  const map = state.idMap;
  const swap = (value: unknown): unknown => {
    if (typeof value === 'number' && value < 0 && map[String(value)] !== undefined) return map[String(value)];
    if (Array.isArray(value)) return value.map(swap);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, swap(v)]));
    }
    return value;
  };
  const path = op.path.replace(/\/(-\d+)\//g, (m, id: string) => (map[id] !== undefined ? `/${map[id]}/` : m));
  return { ...op, path, body: swap(op.body) as Record<string, unknown> };
}

/** Vrai numéro d'un élément créé hors-ligne, s'il a déjà été synchronisé. */
export function realIdFor(id: number): number | undefined {
  return id < 0 ? state.idMap[String(id)] : id;
}

/** À la connexion : si un autre compte se connecte sur ce téléphone, la
 * file du précédent ne doit surtout pas partir sur ce nouveau compte. */
export async function claimOutbox(userId: number) {
  await loadOutbox();
  if (state.ownerId === userId) return;
  state = { ops: [], idMap: {}, lastTempId: state.lastTempId, ownerId: userId };
  await persist();
  emit();
}

/** Identifiants provisoires encore présents (élément pas encore créé). */
export function unresolvedTempIds(op: OutboxOp): number[] {
  const found: number[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'number' && value < 0) found.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(op.body);
  for (const m of op.path.matchAll(/\/(-\d+)\//g)) found.push(Number(m[1]));
  return found;
}

/** Opération qui crée l'élément provisoire `tempId`. */
export function creatorOf(tempId: number): OutboxOp | undefined {
  return state.ops.find((op) => op.tempId === tempId);
}

/** À la déconnexion : la file appartient à l'utilisateur qui s'en va. */
export async function clearOutbox() {
  state = { ops: [], idMap: {}, lastTempId: state.lastTempId, ownerId: undefined };
  await persist();
  emit();
}
