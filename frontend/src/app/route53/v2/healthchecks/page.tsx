import type { Metadata } from 'next';

import { ComingSoon } from '@/components/layout/ComingSoon';

export const metadata: Metadata = { title: 'Health checks | Route 53 Console' };

export default function HealthchecksPage() {
  return (
    <ComingSoon
      title="Health checks"
      description="Health checks monitor the health and performance of your web applications, web servers, and other resources."
      breadcrumbs={[{ text: 'Health checks', href: '/route53/v2/healthchecks' }]}
    />
  );
}
