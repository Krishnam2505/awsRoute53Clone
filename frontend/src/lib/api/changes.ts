'use client';

import { useMutation } from '@tanstack/react-query';

import { apiRequest } from './client';
import { useInvalidateZone } from './records';
import type { ChangeBatchRequest, ChangeInfo } from './types';

export const changesApi = {
  submit: (zoneId: string, body: ChangeBatchRequest) =>
    apiRequest<ChangeInfo>(`/hostedzones/${zoneId}/changes`, { method: 'POST', body }),
  get: (changeId: string) => apiRequest<ChangeInfo>(`/changes/${changeId}`),
};

/** Atomic CREATE / UPSERT / DELETE batch: powers multi-record create and bulk delete. */
export function useChangeBatch(zoneId: string) {
  const invalidate = useInvalidateZone(zoneId);
  return useMutation({
    mutationFn: (body: ChangeBatchRequest) => changesApi.submit(zoneId, body),
    onSuccess: () => invalidate(),
  });
}
