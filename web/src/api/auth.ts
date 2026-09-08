import { apiRequest, clearTokens, setTokens } from './client';
import type { Me } from './types';

export interface RegisterInput {
  username: string;
  password: string;
  email?: string;
  phone?: string;
  base_currency?: string;
  language?: string;
}

export function register(input: RegisterInput) {
  return apiRequest<Me>('/auth/register/', { method: 'POST', body: input, auth: false });
}

export async function login(username: string, password: string) {
  const data = await apiRequest<{ access: string; refresh: string }>('/auth/token/', {
    method: 'POST',
    body: { username, password },
    auth: false,
  });
  setTokens(data.access, data.refresh);
  return data;
}

export function logout() {
  clearTokens();
}

export function fetchMe() {
  return apiRequest<Me>('/auth/me/');
}

export function updateMe(patch: Partial<Pick<Me, 'phone' | 'language' | 'base_currency' | 'display_currency' | 'email'>>) {
  return apiRequest<Me>('/auth/me/', { method: 'PATCH', body: patch });
}

export function uploadAvatar(file: File) {
  const form = new FormData();
  form.append('avatar', file);
  return apiRequest<Me>('/auth/me/avatar/', { method: 'POST', body: form });
}

export function deleteAvatar() {
  return apiRequest<Me>('/auth/me/avatar/', { method: 'DELETE' });
}

export function requestPasswordReset(identifier: string) {
  return apiRequest<{ detail: string }>('/auth/password-reset/request/', {
    method: 'POST',
    body: { identifier },
    auth: false,
  });
}

export function confirmPasswordReset(identifier: string, code: string, newPassword: string) {
  return apiRequest<{ detail: string }>('/auth/password-reset/confirm/', {
    method: 'POST',
    body: { identifier, code, new_password: newPassword },
    auth: false,
  });
}
