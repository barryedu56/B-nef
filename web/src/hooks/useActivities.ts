import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as activitiesApi from '@/api/activities';
import type { Activity } from '@/api/types';

export function useActivities() {
  return useQuery({
    queryKey: ['activities'],
    queryFn: () => activitiesApi.listActivities({ is_archived: false }),
  });
}

export function useArchivedActivities() {
  return useQuery({
    queryKey: ['activities', 'archived'],
    queryFn: () => activitiesApi.listActivities({ is_archived: true }),
  });
}

export function useActivity(id: number | undefined) {
  return useQuery({
    queryKey: ['activities', id],
    queryFn: () => activitiesApi.fetchActivity(id as number),
    enabled: id !== undefined,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activitiesApi.createActivity,
    onSuccess: (activity: Activity) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.setQueryData(['activities', activity.id], activity);
    },
  });
}

export function useUpdateActivity(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof activitiesApi.updateActivity>[1]) => activitiesApi.updateActivity(id, patch),
    onSuccess: (activity: Activity) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.setQueryData(['activities', id], activity);
    },
  });
}
