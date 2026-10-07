import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ComingSoon } from '@/components/layout/ComingSoon';

// Every other item in the Route 53 navigation pane gets a Coming soon page
const SECTIONS: Record<string, string> = {
  cidrcollections: 'CIDR collections',
  policyrecords: 'Policy records',
  domains: 'Registered domains',
  'domains/requests': 'Requests',
  'resolver/inbound-endpoints': 'Inbound endpoints',
  'resolver/outbound-endpoints': 'Outbound endpoints',
  'resolver/rules': 'Rules',
  'resolver/query-logging': 'Query logging',
  'firewall/rule-groups': 'Rule groups',
  'firewall/domain-lists': 'Domain lists',
};

type Props = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = SECTIONS[slug.join('/')];
  return { title: title ? `${title} | Route 53 Console` : 'Route 53 Console' };
}

export default async function SectionPage({ params }: Props) {
  const { slug } = await params;
  const path = slug.join('/');
  const title = SECTIONS[path];
  if (!title) notFound();
  return <ComingSoon title={title} breadcrumbs={[{ text: title, href: `/route53/v2/${path}` }]} />;
}
