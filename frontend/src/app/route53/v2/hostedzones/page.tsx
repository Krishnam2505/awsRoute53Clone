import type { Metadata } from 'next';
import { Suspense } from 'react';

import { HostedZonesTable } from '@/components/hosted-zones/HostedZonesTable';

export const metadata: Metadata = { title: 'Hosted zones | Route 53 Console' };

export default function HostedZonesPage() {
  return (
    <Suspense>
      <HostedZonesTable />
    </Suspense>
  );
}
