import type { Metadata } from 'next';

import { ComingSoon } from '@/components/layout/ComingSoon';

export const metadata: Metadata = { title: 'Resolver | Route 53 Console' };

export default function ResolverPage() {
  return (
    <ComingSoon
      title="Resolver"
      description="Route 53 Resolver answers DNS queries for VPC domain names and forwards other queries."
      breadcrumbs={[{ text: 'Resolver', href: '/route53/v2/resolver' }]}
    />
  );
}
