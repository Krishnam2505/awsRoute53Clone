import type { RecordSet, RoutingPolicy, ZoneType } from '@/lib/api/types';

/** 'www.example.com.' -> 'www.example.com', the way the console shows names. */
export function displayName(fqdn: string): string {
  return fqdn.endsWith('.') ? fqdn.slice(0, -1) : fqdn;
}

/** '123456789012' -> '1234-5678-9012' */
export function formatAccountId(accountId: string): string {
  return accountId.replace(/^(\d{4})(\d{4})(\d{4})$/, '$1-$2-$3');
}

export function zoneTypeLabel(type: ZoneType): string {
  return type === 'private' ? 'Private' : 'Public';
}

export const ROUTING_POLICY_LABELS: Record<RoutingPolicy, string> = {
  SIMPLE: 'Simple',
  WEIGHTED: 'Weighted',
  LATENCY: 'Latency',
  FAILOVER: 'Failover',
  MULTIVALUE: 'Multivalue answer',
  GEOLOCATION: 'Geolocation',
  GEOPROXIMITY: 'Geoproximity',
  IP_BASED: 'IP-based',
};

/** The console's "Differentiator" column: what distinguishes record sets with one name. */
export function differentiator(record: RecordSet): string {
  switch (record.routing_policy) {
    case 'WEIGHTED':
      return record.weight === null ? '-' : String(record.weight);
    case 'LATENCY':
      return record.region ?? '-';
    case 'FAILOVER':
      return record.failover === 'PRIMARY' ? 'Primary' : record.failover ? 'Secondary' : '-';
    default:
      return '-';
  }
}

export function recordValueLines(record: RecordSet): string[] {
  return record.alias ? [record.alias.dns_name] : record.values;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}
