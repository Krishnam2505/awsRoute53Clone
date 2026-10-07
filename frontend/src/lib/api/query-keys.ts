import type { ListParams } from './types';

export interface RecordListParams extends ListParams {
  type?: string;
  routing_policy?: string;
}

export interface ZoneListParams extends ListParams {
  type?: string;
}

/** Central query keys so every mutation can invalidate exactly what it changed. */
export const queryKeys = {
  me: ['auth', 'me'] as const,
  zones: ['hostedzones'] as const,
  zoneList: (params: ZoneListParams) => ['hostedzones', 'list', params] as const,
  zone: (zoneId: string) => ['hostedzones', 'detail', zoneId] as const,
  records: (zoneId: string) => ['hostedzones', 'detail', zoneId, 'records'] as const,
  recordList: (zoneId: string, params: RecordListParams) =>
    ['hostedzones', 'detail', zoneId, 'records', 'list', params] as const,
  record: (zoneId: string, recordId: string) =>
    ['hostedzones', 'detail', zoneId, 'records', 'one', recordId] as const,
};
