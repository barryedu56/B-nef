import { apiRequest } from './client';
import type { Currency } from './types';

export function fetchCurrencies() {
  return apiRequest<Currency[]>('/currencies/');
}

export function convertAmount(amount: number, from: string, to: string) {
  return apiRequest<{ amount: number; from: string; to: string; on: string | null; rate: string; result: string }>(
    '/convert/',
    { params: { amount, from, to } }
  );
}
