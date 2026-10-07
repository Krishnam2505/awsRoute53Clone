import type { Metadata } from 'next';
import { Suspense } from 'react';

import { HostedZoneDetails } from '@/components/hosted-zones/HostedZoneDetails';

export const metadata: Metadata = { title: 'Hosted zone details | Route 53 Console' };

export default async function HostedZonePage({ params }: { params: Promise<{ zoneId: string }> }) {
  const { zoneId } = await params;
  return (
    <Suspense>
      <HostedZoneDetails zoneId={zoneId} />
    </Suspense>
  );
}
