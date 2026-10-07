import type { Metadata } from 'next';

import { HostedZoneForm } from '@/components/hosted-zones/HostedZoneForm';

export const metadata: Metadata = { title: 'Create hosted zone | Route 53 Console' };

export default function CreateHostedZonePage() {
  return <HostedZoneForm mode="create" />;
}
