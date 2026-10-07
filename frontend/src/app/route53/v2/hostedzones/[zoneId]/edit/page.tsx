import type { Metadata } from 'next';

import { EditHostedZone } from '@/components/hosted-zones/EditHostedZone';

export const metadata: Metadata = { title: 'Edit hosted zone | Route 53 Console' };

export default async function EditHostedZonePage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  return <EditHostedZone zoneId={zoneId} />;
}
