import type { Metadata } from 'next';

import { ComingSoon } from '@/components/layout/ComingSoon';

export const metadata: Metadata = { title: 'Profiles | Route 53 Console' };

export default function ProfilesPage() {
  return (
    <ComingSoon
      title="Profiles"
      description="Route 53 Profiles let you share DNS settings with many VPCs."
      breadcrumbs={[{ text: 'Profiles', href: '/route53/v2/profiles' }]}
    />
  );
}
