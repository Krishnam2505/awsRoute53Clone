'use client';

import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';

import type { Crumb } from '@/lib/console';
import { useFollow } from '@/lib/navigation';

/** "Route 53 > Hosted zones > example.com", with client-side navigation. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const onFollow = useFollow();
  return (
    <BreadcrumbGroup
      items={[{ text: 'Route 53', href: '/route53/v2/home' }, ...items]}
      ariaLabel="Breadcrumbs"
      expandAriaLabel="Show path"
      onFollow={onFollow}
    />
  );
}
