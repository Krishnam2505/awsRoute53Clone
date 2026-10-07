import type { Metadata } from 'next';

import { CreateRecordPage } from '@/components/records/RecordFormPage';

export const metadata: Metadata = { title: 'Create record | Route 53 Console' };

export default async function Page({ params }: { params: Promise<{ zoneId: string }> }) {
  const { zoneId } = await params;
  return <CreateRecordPage zoneId={zoneId} />;
}
