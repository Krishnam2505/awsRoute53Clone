'use client';

import { LoadingOrError } from '@/components/common/LoadingOrError';
import { useHostedZone } from '@/lib/api';

import { HostedZoneForm } from './HostedZoneForm';

export function EditHostedZone({ zoneId }: { zoneId: string }) {
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
  return <HostedZoneForm mode="edit" zone={zone.data} />;
}
