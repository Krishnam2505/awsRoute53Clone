'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';
import { type ZoneListParams, queryKeys } from './query-keys';
import type {
  HostedZoneCreate,
  HostedZoneDetail,
  HostedZoneSummary,
  HostedZoneUpdate,
  HostedZoneWriteResponse,
  Page,
} from './types';

export const hostedZonesApi = {
  list: (params: ZoneListParams) =>
    apiRequest<Page<HostedZoneSummary>>('/hostedzones', { query: { ...params } }),
  get: (zoneId: string) => apiRequest<HostedZoneDetail>(`/hostedzones/${zoneId}`),
  create: (body: HostedZoneCreate) =>
    apiRequest<HostedZoneWriteResponse>('/hostedzones', { method: 'POST', body }),
  update: (zoneId: string, body: HostedZoneUpdate) =>
    apiRequest<HostedZoneWriteResponse>(`/hostedzones/${zoneId}`, { method: 'PATCH', body }),
  remove: (zoneId: string) => apiRequest<void>(`/hostedzones/${zoneId}`, { method: 'DELETE' }),
};

export function useHostedZones(params: ZoneListParams) {
  return useQuery({
    queryKey: queryKeys.zoneList(params),
    queryFn: () => hostedZonesApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useHostedZone(zoneId: string) {
  return useQuery({ queryKey: queryKeys.zone(zoneId), queryFn: () => hostedZonesApi.get(zoneId) });
}

export function useCreateHostedZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hostedZonesApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.zones }),
  });
}

export function useUpdateHostedZone(zoneId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: HostedZoneUpdate) => hostedZonesApi.update(zoneId, body),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.zone(zoneId), data.hosted_zone);
      return queryClient.invalidateQueries({ queryKey: queryKeys.zones });
    },
  });
}

export function useDeleteHostedZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hostedZonesApi.remove,
    // Only the list: refetching the deleted zone's own page would just 404
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hostedzones', 'list'] }),
  });
}
