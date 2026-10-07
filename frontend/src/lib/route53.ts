/** Static console data: record types, routing policies, regions and mocked AWS resources. */
import type { RecordType, RoutingPolicy } from '@/lib/api/types';

export interface RecordTypeInfo {
  type: RecordType;
  description: string;
  placeholder: string;
  constraint: string;
}

// Order and wording follow the console's Record type dropdown
export const RECORD_TYPES: RecordTypeInfo[] = [
  {
    type: 'A',
    description: 'Routes traffic to an IPv4 address and some AWS resources',
    placeholder: '192.0.2.235',
    constraint: 'Enter one IPv4 address per line.',
  },
  {
    type: 'AAAA',
    description: 'Routes traffic to an IPv6 address and some AWS resources',
    placeholder: '2001:0db8:85a3:0:0:8a2e:0370:7334',
    constraint: 'Enter one IPv6 address per line.',
  },
  {
    type: 'CAA',
    description: 'Restricts CAs that can create SSL/TLS certifications for the domain',
    placeholder: '0 issue "ca.example.net"',
    constraint: 'Format: flags tag "value". Tag is issue, issuewild or iodef.',
  },
  {
    type: 'CNAME',
    description: 'Routes traffic to another domain name and to some AWS resources',
    placeholder: 'hostname.example.com',
    constraint: 'Enter one domain name.',
  },
  {
    type: 'MX',
    description: 'Specifies mail servers',
    placeholder: '10 mailserver.example.com',
    constraint: 'Format: priority domain-name. Priority is 0 to 65535.',
  },
  {
    type: 'NS',
    description: 'Identifies the name servers for the hosted zone',
    placeholder: 'ns-1.example.com',
    constraint: 'Enter one name server per line.',
  },
  {
    type: 'PTR',
    description: 'Maps an IP address to a domain name',
    placeholder: 'hostname.example.com',
    constraint: 'Enter one domain name per line.',
  },
  {
    type: 'SOA',
    description: 'Start of authority record',
    placeholder: 'ns-2048.awsdns-64.net hostmaster.awsdns.com 1 1 1 1 60',
    constraint: 'Primary name server, admin email, serial, refresh, retry, expire, minimum TTL.',
  },
  {
    type: 'SRV',
    description: 'Application-specific values that identify servers',
    placeholder: '1 10 5269 xmpp-server.example.com',
    constraint: 'Format: priority weight port target. Numbers are 0 to 65535.',
  },
  {
    type: 'TXT',
    description: 'Verifies email senders and application-specific values',
    placeholder: '"Sample Text Entries"',
    constraint: 'Enclose text in quotation marks. Each string can have up to 255 characters.',
  },
];

export const CREATABLE_RECORD_TYPES = RECORD_TYPES.filter((t) => t.type !== 'SOA');

export function recordTypeInfo(type: RecordType): RecordTypeInfo {
  return RECORD_TYPES.find((t) => t.type === type) ?? RECORD_TYPES[0];
}

export interface RoutingPolicyInfo {
  value: RoutingPolicy;
  label: string;
  description: string;
  supported: boolean;
}

export const ROUTING_POLICIES: RoutingPolicyInfo[] = [
  {
    value: 'SIMPLE',
    label: 'Simple routing',
    description: 'Route traffic to a single resource, such as a web server.',
    supported: true,
  },
  {
    value: 'WEIGHTED',
    label: 'Weighted',
    description: 'Route traffic to multiple resources in proportions that you specify.',
    supported: true,
  },
  {
    value: 'GEOLOCATION',
    label: 'Geolocation',
    description: 'Route traffic based on the location of your users.',
    supported: false,
  },
  {
    value: 'LATENCY',
    label: 'Latency',
    description: 'Route traffic to the Region that provides the best latency.',
    supported: true,
  },
  {
    value: 'FAILOVER',
    label: 'Failover',
    description: 'Configure active-passive failover.',
    supported: true,
  },
  {
    value: 'MULTIVALUE',
    label: 'Multivalue answer',
    description: 'Respond to DNS queries with up to eight healthy records selected at random.',
    supported: true,
  },
  {
    value: 'IP_BASED',
    label: 'IP-based',
    description: 'Route traffic based on the location of your users, using their IP addresses.',
    supported: false,
  },
  {
    value: 'GEOPROXIMITY',
    label: 'Geoproximity',
    description: 'Route traffic based on the location of your resources and your users.',
    supported: false,
  },
];

export const AWS_REGIONS: { code: string; name: string }[] = [
  { code: 'us-east-1', name: 'US East (N. Virginia)' },
  { code: 'us-east-2', name: 'US East (Ohio)' },
  { code: 'us-west-1', name: 'US West (N. California)' },
  { code: 'us-west-2', name: 'US West (Oregon)' },
  { code: 'af-south-1', name: 'Africa (Cape Town)' },
  { code: 'ap-east-1', name: 'Asia Pacific (Hong Kong)' },
  { code: 'ap-south-1', name: 'Asia Pacific (Mumbai)' },
  { code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
  { code: 'ap-northeast-2', name: 'Asia Pacific (Seoul)' },
  { code: 'ap-northeast-3', name: 'Asia Pacific (Osaka)' },
  { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
  { code: 'ap-southeast-2', name: 'Asia Pacific (Sydney)' },
  { code: 'ca-central-1', name: 'Canada (Central)' },
  { code: 'eu-central-1', name: 'Europe (Frankfurt)' },
  { code: 'eu-west-1', name: 'Europe (Ireland)' },
  { code: 'eu-west-2', name: 'Europe (London)' },
  { code: 'eu-west-3', name: 'Europe (Paris)' },
  { code: 'eu-north-1', name: 'Europe (Stockholm)' },
  { code: 'eu-south-1', name: 'Europe (Milan)' },
  { code: 'me-south-1', name: 'Middle East (Bahrain)' },
  { code: 'sa-east-1', name: 'South America (São Paulo)' },
];

export function regionLabel(code: string): string {
  const region = AWS_REGIONS.find((r) => r.code === code);
  return region ? `${region.name} ${region.code}` : code;
}

function hexFrom(seed: string, length: number): string {
  let hash = 2166136261;
  let out = '';
  for (let i = 0; out.length < length; i++) {
    hash ^= seed.charCodeAt(i % seed.length) + i;
    hash = Math.imul(hash, 16777619) >>> 0;
    out += hash.toString(16).padStart(8, '0');
  }
  return out.slice(0, length);
}

// The seeded private zone uses these, so they appear in the dropdown too
const KNOWN_VPCS: Record<string, string> = {
  'us-east-1': 'vpc-0a1b2c3d4e5f67890',
  'eu-west-1': 'vpc-0123456789abcdef0',
};

/** Mocked VPCs offered when creating a private hosted zone. Nothing real is called. */
export function mockVpcsFor(region: string): { id: string; name: string }[] {
  return [
    { id: KNOWN_VPCS[region] ?? `vpc-0${hexFrom(`${region}-default`, 16)}`, name: 'default' },
    { id: `vpc-0${hexFrom(`${region}-production`, 16)}`, name: 'production' },
    { id: `vpc-0${hexFrom(`${region}-staging`, 16)}`, name: 'staging' },
  ];
}

export type AliasEndpoint =
  'zone' | 'cloudfront' | 's3' | 'elb' | 'apigateway' | 'beanstalk' | 'vpce' | 'nlb';

export interface AliasEndpointInfo {
  value: AliasEndpoint;
  label: string;
  needsRegion: boolean;
  placeholder: string;
}

export const ALIAS_ENDPOINTS: AliasEndpointInfo[] = [
  {
    value: 'apigateway',
    label: 'Alias to API Gateway API',
    needsRegion: true,
    placeholder: 'd-abcde12345.execute-api.us-east-1.amazonaws.com',
  },
  {
    value: 'vpce',
    label: 'Alias to VPC endpoint',
    needsRegion: true,
    placeholder: 'vpce-0123456789abcdef0-abcdefgh.vpce-svc.us-east-1.vpce.amazonaws.com',
  },
  {
    value: 'elb',
    label: 'Alias to Application and Classic Load Balancer',
    needsRegion: true,
    placeholder: 'my-load-balancer-1234567890.us-east-1.elb.amazonaws.com',
  },
  {
    value: 'nlb',
    label: 'Alias to Network Load Balancer',
    needsRegion: true,
    placeholder: 'my-nlb-1234567890abcdef.elb.us-east-1.amazonaws.com',
  },
  {
    value: 'beanstalk',
    label: 'Alias to Elastic Beanstalk environment',
    needsRegion: true,
    placeholder: 'my-env.us-east-1.elasticbeanstalk.com',
  },
  {
    value: 'cloudfront',
    label: 'Alias to CloudFront distribution',
    needsRegion: false,
    placeholder: 'd111111abcdef8.cloudfront.net',
  },
  {
    value: 's3',
    label: 'Alias to S3 website endpoint',
    needsRegion: true,
    placeholder: 's3-website-us-east-1.amazonaws.com',
  },
  {
    value: 'zone',
    label: 'Alias to another record in this hosted zone',
    needsRegion: false,
    placeholder: 'www.example.com',
  },
];

// Hosted zone IDs AWS publishes for alias targets (a representative subset)
const REGIONAL_ALIAS_ZONES: Partial<Record<AliasEndpoint, Record<string, string>>> = {
  s3: {
    'us-east-1': 'Z3AQBSTGFYJSTF',
    'us-west-2': 'Z3BJ6K6RIION7M',
    'eu-west-1': 'Z1BKCTXD74EZPE',
  },
  elb: {
    'us-east-1': 'Z35SXDOTRQ7X7K',
    'us-west-2': 'Z1H1FL5HABSF5',
    'eu-west-1': 'Z32O12XQLNTSW2',
  },
  nlb: {
    'us-east-1': 'Z26RNL4JYFTOTI',
    'us-west-2': 'Z18D5FSROUN65G',
    'eu-west-1': 'Z2IFOLAFXWLO4F',
  },
  apigateway: { 'us-east-1': 'Z1UJRXOUMOOFQ8', 'us-west-2': 'Z2OJLYMUO9EFXC' },
  beanstalk: { 'us-east-1': 'Z117KPS5GTRQ2G', 'us-west-2': 'Z38NKT9BP95V3O' },
  vpce: { 'us-east-1': 'Z7HUB22UULQXV', 'us-west-2': 'Z1YSA3EXCYUU9Z' },
};

export const CLOUDFRONT_ZONE_ID = 'Z2FDTNDATAQYW2';

export function aliasZoneId(endpoint: AliasEndpoint, region: string, ownZoneId: string): string {
  if (endpoint === 'zone') return ownZoneId;
  if (endpoint === 'cloudfront') return CLOUDFRONT_ZONE_ID;
  return REGIONAL_ALIAS_ZONES[endpoint]?.[region] ?? 'Z35SXDOTRQ7X7K';
}

/** Best guess at which endpoint type an existing alias points to, for the edit form. */
export function guessAliasEndpoint(
  zoneId: string,
  ownZoneId: string,
  dnsName: string,
): AliasEndpoint {
  if (zoneId === ownZoneId) return 'zone';
  if (zoneId === CLOUDFRONT_ZONE_ID || dnsName.includes('cloudfront.net')) return 'cloudfront';
  for (const [endpoint, zones] of Object.entries(REGIONAL_ALIAS_ZONES)) {
    if (Object.values(zones ?? {}).includes(zoneId)) return endpoint as AliasEndpoint;
  }
  if (dnsName.includes('s3-website')) return 's3';
  return 'elb';
}

export function guessAliasRegion(zoneId: string, dnsName: string): string {
  for (const zones of Object.values(REGIONAL_ALIAS_ZONES)) {
    for (const [region, id] of Object.entries(zones ?? {})) if (id === zoneId) return region;
  }
  return AWS_REGIONS.find((r) => dnsName.includes(r.code))?.code ?? 'us-east-1';
}
