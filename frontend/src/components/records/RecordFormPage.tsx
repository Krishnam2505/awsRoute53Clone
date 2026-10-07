'use client';

import { LoadingOrError } from '@/components/common/LoadingOrError';
import { useHostedZone, useRecord } from '@/lib/api';

import { RecordForm } from './RecordForm';

export function CreateRecordPage({ zoneId }: { zoneId: string }) {
  const zone = useHostedZone(zoneId);
  if (!zone.data) {
    return (
      <LoadingOrError
        loading={zone.isLoading}
        error={zone.error}
        what="hosted zone"
        backHref="/route53/v2/hostedzones"
        backLabel="Go to hosted zones"
      />
    );
  }
  return <RecordForm mode="create" zone={zone.data} />;
}

export function EditRecordPage({ zoneId, recordId }: { zoneId: string; recordId: string }) {
  const zone = useHostedZone(zoneId);
  const record = useRecord(zoneId, recordId);
  if (!zone.data || !record.data) {
    return (
      <LoadingOrError
        loading={zone.isLoading || record.isLoading}
        error={zone.error ?? record.error}
        what="record"
        backHref={`/route53/v2/hostedzones/${zoneId}`}
        backLabel="Go to hosted zone"
      />
    );
  }
  // Key on updated_at so a refetch after saving resets the form to the saved values
  return (
    <RecordForm key={record.data.updated_at} mode="edit" zone={zone.data} record={record.data} />
  );
}
