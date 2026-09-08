import { apiRequest } from './client';
import type { Paginated, Party, PartyKind } from './types';

export async function listParties(params?: { kind?: PartyKind; is_archived?: boolean }) {
  const data = await apiRequest<Paginated<Party>>('/parties/', { params });
  return data.results;
}

export interface PartyInput {
  name: string;
  phone?: string;
  kind?: PartyKind;
  note?: string;
}

export function createParty(input: PartyInput) {
  return apiRequest<Party>('/parties/', { method: 'POST', body: input });
}

export function updateParty(id: number, patch: Partial<PartyInput> & { is_archived?: boolean }) {
  return apiRequest<Party>(`/parties/${id}/`, { method: 'PATCH', body: patch });
}

export function fetchPartyTotals() {
  return apiRequest<{ receivable: string; payable: string }>('/parties/totals/');
}

export function fetchParty(id: number) {
  return apiRequest<Party>(`/parties/${id}/`);
}
