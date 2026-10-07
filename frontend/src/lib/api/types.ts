/**
 * Friendly names for the schemas generated from FastAPI's OpenAPI document.
 * Run `npm run gen:api` after changing a backend schema.
 */
import type { components } from '@/lib/api-types';

type Schemas = components['schemas'];

export type User = Schemas['UserOut'];
export type LoginRequest = Schemas['LoginRequest'];

export type HostedZoneSummary = Schemas['HostedZoneSummary'];
export type HostedZoneDetail = Schemas['HostedZoneDetail'];
export type HostedZoneCreate = Schemas['HostedZoneCreate'];
export type HostedZoneUpdate = Schemas['HostedZoneUpdate'];
export type HostedZoneWriteResponse = Schemas['HostedZoneWriteResponse'];
export type ZoneType = HostedZoneSummary['type'];
export type Tag = Schemas['Tag'];
export type Vpc = Schemas['VPCIn'];

export type RecordSet = Schemas['RecordSetOut'];
export type RecordSetCreate = Schemas['RecordSetCreate'];
export type RecordSetUpdate = Schemas['RecordSetUpdate'];
export type RecordSetWriteResponse = Schemas['RecordSetWriteResponse'];
export type RecordType = RecordSet['type'];
export type RoutingPolicy = RecordSet['routing_policy'];
export type AliasTarget = Schemas['AliasTarget'];

export type ChangeInfo = Schemas['ChangeInfo'];
export type ChangeAction = Schemas['ChangeAction'];
export type ChangeBatchRequest = Schemas['ChangeBatchRequest'];

export type ImportResult = Schemas['ImportResult'];

export type ErrorBody = Schemas['ErrorBody'];
export type FieldError = Schemas['FieldError'];

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ListParams {
  search?: string;
  page?: number;
  page_size?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
