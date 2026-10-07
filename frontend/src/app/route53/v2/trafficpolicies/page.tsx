import type { Metadata } from 'next';

import { ComingSoon } from '@/components/layout/ComingSoon';

export const metadata: Metadata = { title: 'Traffic policies | Route 53 Console' };

export default function TrafficpoliciesPage() {
  return (
    <ComingSoon
      title="Traffic policies"
      description="Traffic flow lets you create policies that route traffic across multiple resources."
      breadcrumbs={[{ text: 'Traffic policies', href: '/route53/v2/trafficpolicies' }]}
    />
  );
}
