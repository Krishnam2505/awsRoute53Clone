'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';
import { type RecordListParams, queryKeys } from './query-keys';
import type {
  Page,
  RecordSet,
  RecordSetCreate,
  RecordSetUpdate,
  RecordSetWriteResponse,
} from './types';

const base = (zoneId: string) => `/hostedzones/${zoneId}/records`;

export const recordsApi = {
  list: (zoneId: string, params: RecordListParams) =>
    apiRequest<Page<RecordSet>>(base(zoneId), { query: { ...params } }),
  get: (zoneId: string, recordId: string) => apiRequest<RecordSet>(`${base(zoneId)}/${recordId}`),
  create: (zoneId: string, body: RecordSetCreate) =>
    apiRequest<RecordSetWriteResponse>(base(zoneId), { method: 'POST', body }),
  update: (zoneId: string, recordId: string, body: RecordSetUpdate) =>
    apiRequest<RecordSetWriteResponse>(`${base(zoneId)}/${recordId}`, { method: 'PUT', body }),
  remove: (zoneId: string, recordId: string) =>
    apiRequest<void>(`${base(zoneId)}/${recordId}`, { method: 'DELETE' }),
};

export function useRecords(
  zoneId: string,
  params: RecordListParams,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.recordList(zoneId, params),
    queryFn: () => recordsApi.list(zoneId, params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useRecord(zoneId: string, recordId: string) {
  return useQuery({
    queryKey: queryKeys.record(zoneId, recordId),
    queryFn: () => recordsApi.get(zoneId, recordId),
  });
}

/** After any record write, refetch the records table and the zone's record count. */
export function useInvalidateZone(zoneId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.zone(zoneId) }),
      queryClient.invalidateQueries({ queryKey: ['hostedzones', 'list'] }),
    ]);
}

export function useUpdateRecord(zoneId: string, recordId: string) {
  const invalidate = useInvalidateZone(zoneId);
  return useMutation({
    mutationFn: (body: RecordSetUpdate) => recordsApi.update(zoneId, recordId, body),
    onSuccess: () => invalidate(),
  });
}
