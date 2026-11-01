import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as partiesApi from '@/api/parties';
import type { Party, PartyKind } from '@/api/types';
import * as offline from '@/offline/actions';
import { findCachedItem } from '@/offline/cacheLookup';
import { isQueued } from '@/offline/send';

export function useParties(kind?: PartyKind) {
  return useQuery({
    queryKey: ['parties', kind],
    queryFn: () => partiesApi.listParties({ kind, is_archived: false }),
  });
}

export function useParty(id: number | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['parties', 'detail', id],
    queryFn: () => partiesApi.fetchParty(id as number),
    enabled: id !== undefined,
    // Hors connexion : la fiche gardée dans la liste des tiers.
    initialData: () => findCachedItem<Party>(queryClient, ['parties'], id),
    initialDataUpdatedAt: 0,
  });
}

export function usePartyTotals() {
  return useQuery({ queryKey: ['parties', 'totals'], queryFn: partiesApi.fetchPartyTotals });
}

export function useCreateParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: offline.createParty,
    onSuccess: (party) => {
      if (!isQueued(party)) queryClient.invalidateQueries({ queryKey: ['parties'] });
    },
  });
}

export function useUpdateParty(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    // Fonctionne hors connexion : envoyé au retour du réseau.
    mutationFn: (patch: Parameters<typeof partiesApi.updateParty>[1]) =>
      offline.updateParty(
        queryClient.getQueryData<Party>(['parties', 'detail', id]) ??
          findCachedItem<Party>(queryClient, ['parties'], id) ?? ({ id } as Party),
        patch
      ),
    onSuccess: (party: Party) => {
      if (isQueued(party)) return; // cache déjà mis à jour
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.setQueryData(['parties', 'detail', id], party);
    },
  });
}

/** Bilan du tiers : acheté / payé, vendu / encaissé, reste dû. */
export function usePartyStatement(id: number | undefined) {
  return useQuery({
    queryKey: ['parties', 'statement', id],
    queryFn: () => partiesApi.fetchPartyStatement(id as number),
    enabled: id !== undefined && id > 0,
  });
}
