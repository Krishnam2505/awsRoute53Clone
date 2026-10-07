'use client';

import Button from '@cloudscape-design/components/button';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import SpaceBetween from '@cloudscape-design/components/space-between';

import type { HostedZoneDetail, RecordSet } from '@/lib/api/types';
import {
  ROUTING_POLICY_LABELS,
  differentiator,
  displayName,
  formatDateTime,
  recordValueLines,
} from '@/lib/format';
import { useFollow } from '@/lib/navigation';
import { regionLabel } from '@/lib/route53';

/** Split-panel content shown when a row in the records table is clicked. */
export function RecordDetailsPanel({
  record,
  zone,
}: {
  record: RecordSet;
  zone: HostedZoneDetail;
}) {
  const onFollow = useFollow();
  const items = [
    { label: 'Record name', value: displayName(record.name) },
    { label: 'Record type', value: record.type },
    {
      label: record.alias ? 'Route traffic to' : 'Value',
      value: (
        <div className="value-lines">
          {recordValueLines(record).map((line, index) => (
            <div key={`${index}-${line}`}>{line}</div>
          ))}
        </div>
      ),
    },
    { label: 'Alias', value: record.alias ? 'Yes' : 'No' },
    { label: 'TTL (seconds)', value: record.ttl ?? '-' },
    { label: 'Routing policy', value: ROUTING_POLICY_LABELS[record.routing_policy] },
    ...(record.routing_policy !== 'SIMPLE'
      ? [
          { label: 'Differentiator', value: differentiator(record) },
          { label: 'Record ID', value: record.set_identifier ?? '-' },
          { label: 'Health check ID', value: record.health_check_id ?? '-' },
        ]
      : []),
    ...(record.region ? [{ label: 'Region', value: regionLabel(record.region) }] : []),
    ...(record.alias
      ? [
          { label: 'Alias hosted zone ID', value: record.alias.hosted_zone_id },
          {
            label: 'Evaluate target health',
            value: record.alias.evaluate_target_health ? 'Yes' : 'No',
          },
        ]
      : []),
    { label: 'Last updated', value: formatDateTime(record.updated_at) },
  ];

  return (
    <SpaceBetween size="l">
      <Button
        href={`/route53/v2/hostedzones/${zone.id}/records/${record.id}/edit`}
        onFollow={onFollow}
      >
        Edit record
      </Button>
      <KeyValuePairs columns={4} items={items} />
    </SpaceBetween>
  );
}
