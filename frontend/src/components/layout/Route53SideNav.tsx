'use client';

import SideNavigation, {
  type SideNavigationProps,
} from '@cloudscape-design/components/side-navigation';
import { usePathname } from 'next/navigation';

import { useFollow } from '@/lib/navigation';

const BASE = '/route53/v2';

// Mirrors the console's Route 53 navigation pane. Only Hosted zones is live.
const ITEMS: SideNavigationProps.Item[] = [
  { type: 'link', text: 'Dashboard', href: `${BASE}/home` },
  { type: 'link', text: 'Hosted zones', href: `${BASE}/hostedzones` },
  { type: 'link', text: 'Health checks', href: `${BASE}/healthchecks` },
  { type: 'link', text: 'Profiles', href: `${BASE}/profiles` },
  {
    type: 'section',
    text: 'IP-based routing',
    items: [{ type: 'link', text: 'CIDR collections', href: `${BASE}/cidrcollections` }],
  },
  {
    type: 'section',
    text: 'Traffic flow',
    items: [
      { type: 'link', text: 'Traffic policies', href: `${BASE}/trafficpolicies` },
      { type: 'link', text: 'Policy records', href: `${BASE}/policyrecords` },
    ],
  },
  {
    type: 'section',
    text: 'Domains',
    items: [
      { type: 'link', text: 'Registered domains', href: `${BASE}/domains` },
      { type: 'link', text: 'Requests', href: `${BASE}/domains/requests` },
    ],
  },
  {
    type: 'section',
    text: 'Resolver',
    items: [
      { type: 'link', text: 'VPCs', href: `${BASE}/resolver` },
      { type: 'link', text: 'Inbound endpoints', href: `${BASE}/resolver/inbound-endpoints` },
      { type: 'link', text: 'Outbound endpoints', href: `${BASE}/resolver/outbound-endpoints` },
      { type: 'link', text: 'Rules', href: `${BASE}/resolver/rules` },
      { type: 'link', text: 'Query logging', href: `${BASE}/resolver/query-logging` },
    ],
  },
  {
    type: 'section',
    text: 'DNS Firewall',
    defaultExpanded: false,
    items: [
      { type: 'link', text: 'Rule groups', href: `${BASE}/firewall/rule-groups` },
      { type: 'link', text: 'Domain lists', href: `${BASE}/firewall/domain-lists` },
    ],
  },
];

function activeHref(pathname: string): string {
  if (pathname.startsWith(`${BASE}/hostedzones`)) return `${BASE}/hostedzones`;
  return pathname;
}

export function Route53SideNav() {
  const pathname = usePathname();
  const onFollow = useFollow();
  return (
    <SideNavigation
      header={{ text: 'Route 53', href: `${BASE}/home` }}
      activeHref={activeHref(pathname)}
      items={ITEMS}
      onFollow={onFollow}
    />
  );
}
