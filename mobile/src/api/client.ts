import AsyncStorage from '@react-native-async-storage/async-storage';

// Adresse de l'API Django. En dev, mets l'IP locale de ton PC (celle que WAMP /
// `runserver 0.0.0.0:8000` écoute) dans mobile/.env — "localhost" ne fonctionne
// pas depuis un téléphone physique. Voir mobile/README.md.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.141:8000/api';

const ACCESS_KEY = 'gf_access_token';
const REFRESH_KEY = 'gf_refresh_token';

export async function getTokens() {
  const [access, refresh] = await Promise.all([
    AsyncStorage.getItem(ACCESS_KEY),
    AsyncStorage.getItem(REFRESH_KEY),
  ]);
  return { access, refresh };
}

export async function setTokens(access: string, refresh: string) {
  await Promise.all([AsyncStorage.setItem(ACCESS_KEY, access), AsyncStorage.setItem(REFRESH_KEY, refresh)]);
}

async function setAccessToken(access: string) {
  await AsyncStorage.setItem(ACCESS_KEY, access);
}

export async function clearTokens() {
  await Promise.all([AsyncStorage.removeItem(ACCESS_KEY), AsyncStorage.removeItem(REFRESH_KEY)]);
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
  try {
    const res = await fetch(`${API_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) throw new Error('refresh failed');
    const data = (await res.json()) as { access: string };
    await setAccessToken(data.access);
    return data.access;
  } catch {
    await clearTokens();
    return null;
  }
}

export async function apiRequest<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, params } = opts;
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
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, {
        detail: `Impossible de joindre le serveur (${API_URL}). Vérifie que l'API tourne et que EXPO_PUBLIC_API_URL pointe vers la bonne adresse.`,
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
