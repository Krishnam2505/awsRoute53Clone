/** Form state for one record in the create/edit form, and its conversion to API payloads. */
import type {
  HostedZoneDetail,
  RecordSet,
  RecordSetCreate,
  RecordType,
  RoutingPolicy,
} from '@/lib/api/types';
import {
  type AliasEndpoint,
  aliasZoneId,
  guessAliasEndpoint,
  guessAliasRegion,
} from '@/lib/route53';
import { validateRecordSubdomain } from '@/lib/validation/names';
import { validateRecordValues, validateTtl, valuesFromText } from '@/lib/validation/records';

export interface RecordDraft {
  key: string;
  name: string;
  type: RecordType;
  alias: boolean;
  value: string;
  ttl: string;
  routingPolicy: RoutingPolicy;
  setIdentifier: string;
  weight: string;
  region: string;
  failover: '' | 'PRIMARY' | 'SECONDARY';
  healthCheckId: string;
  aliasEndpoint: AliasEndpoint;
  aliasRegion: string;
  aliasTarget: string;
  evaluateTargetHealth: boolean;
}

export type DraftErrors = Record<string, string>;

let counter = 0;

export function emptyDraft(): RecordDraft {
  counter += 1;
  return {
    key: `draft-${counter}`,
    name: '',
    type: 'A',
    alias: false,
    value: '',
    ttl: '300',
    routingPolicy: 'SIMPLE',
    setIdentifier: '',
    weight: '',
    region: '',
    failover: '',
    healthCheckId: '',
    aliasEndpoint: 'cloudfront',
    aliasRegion: 'us-east-1',
    aliasTarget: '',
    evaluateTargetHealth: false,
  };
}

/** 'www.example.com.' in zone 'example.com.' -> 'www'; the apex -> ''. */
export function subdomainOf(fqdn: string, zoneName: string): string {
  if (fqdn === zoneName) return '';
  return fqdn.endsWith(`.${zoneName}`) ? fqdn.slice(0, -(zoneName.length + 1)) : fqdn;
}

export function draftFromRecord(record: RecordSet, zone: HostedZoneDetail): RecordDraft {
  const draft = emptyDraft();
  return {
    ...draft,
    name: subdomainOf(record.name, zone.name),
    type: record.type,
    alias: record.alias !== null,
    value: record.values.join('\n'),
    ttl: record.ttl === null ? '300' : String(record.ttl),
    routingPolicy: record.routing_policy,
    setIdentifier: record.set_identifier ?? '',
    weight: record.weight === null ? '' : String(record.weight),
    region: record.region ?? '',
    failover: record.failover ?? '',
    healthCheckId: record.health_check_id ?? '',
    aliasEndpoint: record.alias
      ? guessAliasEndpoint(record.alias.hosted_zone_id, zone.id, record.alias.dns_name)
      : draft.aliasEndpoint,
    aliasRegion: record.alias
      ? guessAliasRegion(record.alias.hosted_zone_id, record.alias.dns_name)
      : draft.aliasRegion,
    aliasTarget: record.alias ? record.alias.dns_name.replace(/\.$/, '') : '',
    evaluateTargetHealth: record.alias?.evaluate_target_health ?? false,
  };
}

export function draftToPayload(draft: RecordDraft, zone: HostedZoneDetail): RecordSetCreate {
  const nonSimple = draft.routingPolicy !== 'SIMPLE';
  return {
    name: draft.name.trim(),
    type: draft.type,
    ttl: draft.alias ? null : Number(draft.ttl),
    values: draft.alias ? [] : valuesFromText(draft.value),
    routing_policy: draft.routingPolicy,
    set_identifier: nonSimple ? draft.setIdentifier.trim() || null : null,
    weight: draft.routingPolicy === 'WEIGHTED' && draft.weight !== '' ? Number(draft.weight) : null,
    region: draft.routingPolicy === 'LATENCY' ? draft.region || null : null,
    failover: draft.routingPolicy === 'FAILOVER' ? draft.failover || null : null,
    health_check_id: nonSimple ? draft.healthCheckId.trim() || null : null,
    alias: draft.alias
      ? {
          dns_name: draft.aliasTarget.trim(),
          hosted_zone_id: aliasZoneId(draft.aliasEndpoint, draft.aliasRegion, zone.id),
          evaluate_target_health: draft.evaluateTargetHealth,
        }
      : null,
  };
}

/** The same checks the backend makes, keyed by the backend's field names. */
export function validateDraft(draft: RecordDraft, zone: HostedZoneDetail): DraftErrors {
  const errors: DraftErrors = {};
  const nameError = validateRecordSubdomain(draft.name);
  if (nameError) errors.name = nameError;
  if (draft.type === 'CNAME' && draft.name.trim() === '' && !draft.alias) {
    errors.name = `You can't create a CNAME record for the zone apex (${zone.name.replace(/\.$/, '')}).`;
  }

  if (draft.alias) {
    if (!draft.aliasTarget.trim()) errors['alias.dns_name'] = 'Choose or enter an endpoint.';
  } else {
    const ttlError = validateTtl(draft.ttl);
    if (ttlError) errors.ttl = ttlError;
    const issues = validateRecordValues(draft.type, draft.value);
    for (const issue of issues) {
      const key = issue.line < 0 ? 'values' : `values[${issue.line}]`;
      errors[key] ??= issue.message;
    }
  }

  if (draft.routingPolicy !== 'SIMPLE') {
    if (!draft.setIdentifier.trim()) {
      errors.set_identifier = 'Enter a record ID. It must be unique for this record name.';
    } else if (draft.setIdentifier.length > 128) {
      errors.set_identifier = 'The record ID can have a maximum of 128 characters.';
    }
    if (draft.routingPolicy === 'WEIGHTED') {
      const weight = Number(draft.weight);
      if (draft.weight === '' || !Number.isInteger(weight) || weight < 0 || weight > 255) {
        errors.weight = 'Weight must be an integer between 0 and 255.';
      }
    }
    if (draft.routingPolicy === 'LATENCY' && !draft.region) errors.region = 'Choose a Region.';
    if (draft.routingPolicy === 'FAILOVER' && !draft.failover) {
      errors.failover = 'Choose Primary or Secondary.';
    }
  }
  return errors;
}

/** Combine per-line value errors into one message for the textarea. */
export function valueErrorText(errors: DraftErrors): string | undefined {
  const lines = Object.entries(errors)
    .filter(([key]) => key === 'values' || key.startsWith('values['))
    .map(([key, message]) => {
      const match = /^values\[(\d+)\]$/.exec(key);
      return match ? `Line ${Number(match[1]) + 1}: ${message}` : message;
    });
  return lines.length ? lines.join(' ') : undefined;
}
