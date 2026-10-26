import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Adresse de l'API Django. En dev, mets l'IP locale de ton PC (celle que WAMP /
// `runserver 0.0.0.0:8000` écoute) dans mobile/.env — "localhost" ne fonctionne
// pas depuis un téléphone physique. Voir mobile/README.md.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.141:8000/api';

const ACCESS_KEY = 'gf_access_token';
const REFRESH_KEY = 'gf_refresh_token';

// Les jetons donnent accès aux données des clients : rangés dans le
// trousseau chiffré du téléphone (Keychain / Keystore), pas dans
// AsyncStorage qui est en clair. Sur le web (expo start --web), pas de
// trousseau : AsyncStorage (localStorage).
const secure = {
  get: (key: string) => (Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key)),
  set: (key: string, value: string) =>
    Platform.OS === 'web' ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  remove: (key: string) => (Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key)),
};

/** Les versions précédentes rangeaient les jetons dans AsyncStorage : on les
 * déplace une fois dans le trousseau pour ne pas déconnecter l'utilisateur. */
async function migrateLegacyTokens() {
  if (Platform.OS === 'web') return;
  const [access, refresh] = await Promise.all([AsyncStorage.getItem(ACCESS_KEY), AsyncStorage.getItem(REFRESH_KEY)]);
  if (!access && !refresh) return;
  if (access) await secure.set(ACCESS_KEY, access);
  if (refresh) await secure.set(REFRESH_KEY, refresh);
  await Promise.all([AsyncStorage.removeItem(ACCESS_KEY), AsyncStorage.removeItem(REFRESH_KEY)]);
}

let migration: Promise<void> | null = null;

export async function getTokens() {
  migration ??= migrateLegacyTokens().catch(() => {});
  await migration;
  const [access, refresh] = await Promise.all([secure.get(ACCESS_KEY), secure.get(REFRESH_KEY)]);
  return { access, refresh };
}

export async function setTokens(access: string, refresh: string) {
  await Promise.all([secure.set(ACCESS_KEY, access), secure.set(REFRESH_KEY, refresh)]);
}

async function setAccessToken(access: string) {
  await secure.set(ACCESS_KEY, access);
}

export async function clearTokens() {
  await Promise.all([secure.remove(ACCESS_KEY), secure.remove(REFRESH_KEY)]);
}

/** Statut 0 = la requête n'a pas pu atteindre le serveur (pas de réseau,
 * serveur injoignable). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(extractMessage(body, status));
    this.status = status;
    this.body = body;
  }
}

function extractMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.detail === 'string') return b.detail;
    // Erreurs de validation DRF : { field: ["message", ...] }
    const firstKey = Object.keys(b)[0];
    if (firstKey) {
      const val = b[firstKey];
      const msg = Array.isArray(val) ? val[0] : val;
      if (typeof msg === 'string') return msg;
    }
  }
  return `Erreur réseau (${status})`;
}

type Params = Record<string, string | number | boolean | undefined | null>;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  params?: Params;
  headers?: Record<string, string>;
};

function buildUrl(path: string, params?: Params) {
  const base = path.startsWith('http') ? path : `${API_URL}${path}`;
  const url = new URL(base);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = await getTokens();
  if (!refresh) return null;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
  } catch {
    // Réseau coupé : le jeton est peut-être encore bon, on ne déconnecte pas.
    return null;
  }
  if (!res.ok) {
    await clearTokens();
    return null;
  }
  const data = (await res.json()) as { access: string };
  await setAccessToken(data.access);
  return data.access;
}

export async function apiRequest<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, params, headers: extraHeaders } = opts;
  const url = buildUrl(path, params);

  const isFormData = body instanceof FormData;

  const doFetch = async (accessToken: string | null) => {
    // Pour un FormData (upload de fichier), on laisse RN poser son propre
    // Content-Type (avec la boundary multipart) — le fixer à la main casse
    // l'envoi.
    const headers: Record<string, string> = isFormData
      ? { Accept: 'application/json' }
      : { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    Object.assign(headers, extraHeaders);
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (cause) {
      // En développement, la vraie cause (ex. corps de requête refusé par
      // fetch) apparaît dans les logs Metro au lieu d'être confondue avec
      // une simple coupure réseau.
      if (__DEV__) console.warn(`[api] ${method} ${path} :`, cause);
      throw new ApiError(0, {
        detail: onlineManager.isOnline()
          ? `Impossible de joindre le serveur (${API_URL}). Vérifie ta connexion, ou que l'API tourne et que EXPO_PUBLIC_API_URL pointe vers la bonne adresse.`
          : "Pas de connexion internet : cette action nécessite d'être en ligne.",
      });
    }
    return response;
  };

  const { access } = auth ? await getTokens() : { access: null };
  let res = await doFetch(access ?? null);

  if (auth && res.status === 401) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newAccess = await refreshPromise;
    if (newAccess) res = await doFetch(newAccess);
  }

  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      // pas de corps JSON
    }
    throw new ApiError(res.status, payload);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
