'use client';

import { useMutation } from '@tanstack/react-query';

import { apiDownload, apiRequest } from './client';
import { useInvalidateZone } from './records';
import type { ImportResult } from './types';

export type ExportFormat = 'bind' | 'json';

export const importExportApi = {
  importZoneFile: (zoneId: string, zoneFile: string, dryRun: boolean) =>
    apiRequest<ImportResult>(`/hostedzones/${zoneId}/import`, {
      method: 'POST',
      query: { dry_run: dryRun },
      body: { zone_file: zoneFile },
    }),
  exportZone: (zoneId: string, format: ExportFormat, zoneName: string) =>
    apiDownload(
      `/hostedzones/${zoneId}/export`,
      { format },
      `${zoneName}.${format === 'json' ? 'json' : 'zone'}`,
    ),
};

export function useImportZoneFile(zoneId: string) {
  const invalidate = useInvalidateZone(zoneId);
  return useMutation({
    mutationFn: ({ zoneFile, dryRun }: { zoneFile: string; dryRun: boolean }) =>
      importExportApi.importZoneFile(zoneId, zoneFile, dryRun),
    onSuccess: (result) => (result.change ? invalidate() : undefined),
  });
}
