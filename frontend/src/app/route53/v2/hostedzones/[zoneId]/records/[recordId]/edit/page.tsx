import type { Metadata } from 'next';

import { EditRecordPage } from '@/components/records/RecordFormPage';

export const metadata: Metadata = { title: 'Edit record | Route 53 Console' };

export default async function Page({
  params,
}: {
  params: Promise<{ zoneId: string; recordId: string }>;
}) {
  const { zoneId, recordId } = await params;
  return <EditRecordPage zoneId={zoneId} recordId={recordId} />;
}
