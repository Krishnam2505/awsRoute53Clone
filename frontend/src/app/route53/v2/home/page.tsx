import type { Metadata } from 'next';

import { Dashboard } from '@/components/layout/Dashboard';

export const metadata: Metadata = { title: 'Dashboard | Route 53 Console' };

export default function DashboardPage() {
  return <Dashboard />;
}
