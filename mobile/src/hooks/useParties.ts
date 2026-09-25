import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as partiesApi from '@/api/parties';
import type { Party, PartyKind } from '@/api/types';

export function useParties(kind?: PartyKind) {
  return useQuery({
    queryKey: ['parties', kind],
    queryFn: () => partiesApi.listParties({ kind, is_archived: false }),
  });
}

export function useParty(id: number | undefined) {
  return useQuery({
    queryKey: ['parties', 'detail', id],
    queryFn: () => partiesApi.fetchParty(id as number),
    enabled: id !== undefined,
  });
}

export function usePartyTotals() {
  return useQuery({ queryKey: ['parties', 'totals'], queryFn: partiesApi.fetchPartyTotals });
}

export function useCreateParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: partiesApi.createParty,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parties'] }),
  });
}

export function useUpdateParty(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof partiesApi.updateParty>[1]) => partiesApi.updateParty(id, patch),
    onSuccess: (party: Party) => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.setQueryData(['parties', 'detail', id], party);
    },
  });
}
