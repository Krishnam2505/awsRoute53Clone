import Box from '@cloudscape-design/components/box';
import HelpPanel from '@cloudscape-design/components/help-panel';
import Link from '@cloudscape-design/components/link';
import type { ReactNode } from 'react';

interface HelpTopic {
  header: string;
  body: ReactNode;
}

const learnMore = (
  <>
    <h3>Learn more</h3>
    <ul>
      <li>
        <Link
          external
          href="https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-working-with.html"
        >
          Working with hosted zones
        </Link>
      </li>
      <li>
        <Link
          external
          href="https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/rrsets-working-with.html"
        >
          Working with records
        </Link>
      </li>
    </ul>
  </>
);

const TOPICS = {
  dashboard: {
    header: 'Route 53 dashboard',
    body: (
      <p>
        The dashboard summarizes the Route 53 resources in your account. Choose a tile to go to the
        feature, or use the navigation pane.
      </p>
    ),
  },
  hostedZones: {
    header: 'Hosted zones',
    body: (
      <>
        <p>
          A hosted zone is a container for records, which include information about how you want to
          route traffic for a domain (such as example.com) and all of its subdomains (such as
          www.example.com, retail.example.com, and seattle.accounting.example.com).
        </p>
        <p>
          A hosted zone has the same name as the corresponding domain. When you create a hosted
          zone, Route 53 automatically creates a name server (NS) record and a start of authority
          (SOA) record for the zone.
        </p>
      </>
    ),
  },
  createHostedZone: {
    header: 'Create hosted zone',
    body: (
      <p>
        A public hosted zone determines how traffic is routed on the internet. A private hosted zone
        determines how traffic is routed within one or more Amazon VPCs. After you create the hosted
        zone, you create records in it.
      </p>
    ),
  },
  domainName: {
    header: 'Domain name',
    body: (
      <>
        <p>
          Enter the name of the domain that you want to route traffic for, such as example.com.
          Route 53 converts the name to lowercase and adds a trailing dot.
        </p>
        <p>
          Each label can have up to 63 characters, and the whole name can have up to 255 characters.
          You can create more than one hosted zone with the same name.
        </p>
      </>
    ),
  },
  description: {
    header: 'Description',
    body: (
      <p>
        An optional comment that lets you distinguish hosted zones that have the same name. The
        description can have up to 256 characters.
      </p>
    ),
  },
  zoneType: {
    header: 'Type',
    body: (
      <>
        <p>
          <b>Public hosted zone</b> – Determines how traffic is routed on the internet.
        </p>
        <p>
          <b>Private hosted zone</b> – Determines how traffic is routed within the Amazon VPCs that
          you associate with the hosted zone. You must associate at least one VPC.
        </p>
        <p>You can&apos;t change the type after you create the hosted zone.</p>
      </>
    ),
  },
  vpcs: {
    header: 'VPCs to associate with the hosted zone',
    body: (
      <p>
        Route 53 Resolver uses the records in a private hosted zone to answer DNS queries that come
        from the VPCs you associate with it. In this console clone, VPCs are simulated.
      </p>
    ),
  },
  tags: {
    header: 'Tags',
    body: (
      <p>
        A tag is a label that you assign to a hosted zone. Each tag consists of a key and an
        optional value. Use tags to organize hosted zones, for example by environment or cost
        center.
      </p>
    ),
  },
  zoneDetails: {
    header: 'Hosted zone details',
    body: (
      <>
        <p>
          The records tab lists every record in the hosted zone. To route internet traffic for your
          domain, update the name servers at your domain registrar to the four name servers listed
          under <b>Hosted zone details</b>.
        </p>
        <p>
          The NS and SOA records at the apex are created by Route 53. You can edit them, but you
          can&apos;t delete them.
        </p>
      </>
    ),
  },
  nameServers: {
    header: 'Name servers',
    body: (
      <p>
        The four Route 53 name servers that were assigned to the hosted zone. Each one is on a
        different top-level domain (.com, .net, .org and .co.uk) for resilience.
      </p>
    ),
  },
  records: {
    header: 'Records',
    body: (
      <p>
        Each record includes the name of a domain or subdomain, a record type (for example, a record
        with a type of MX routes email), and other information applicable to the record type. Select
        one or more records to delete them, or choose a record to see its details.
      </p>
    ),
  },
  quickCreate: {
    header: 'Quick create record',
    body: (
      <p>
        Specify the values for one or more records, then choose <b>Create records</b>. To add more
        than one record in the same change batch, choose <b>Add another record</b>. All records are
        created together, or none are.
      </p>
    ),
  },
  recordName: {
    header: 'Record name',
    body: (
      <p>
        Enter the subdomain name, or leave it blank to create a record for the root domain (the zone
        apex). You can use an asterisk (*) as the leftmost label to create a wildcard record.
      </p>
    ),
  },
  recordType: {
    header: 'Record type',
    body: (
      <p>
        The DNS record type determines the format of the value. A CNAME record can&apos;t be created
        for the zone apex, and it can&apos;t share its name with any other record.
      </p>
    ),
  },
  value: {
    header: 'Value',
    body: (
      <p>
        Enter one value per line. The format depends on the record type, for example an IPv4 address
        for an A record, or a priority and a domain name for an MX record.
      </p>
    ),
  },
  alias: {
    header: 'Alias',
    body: (
      <p>
        An alias record routes traffic to an AWS resource, such as a CloudFront distribution or an
        Elastic Load Balancing load balancer, or to another record in the same hosted zone. Alias
        records don&apos;t have a TTL.
      </p>
    ),
  },
  ttl: {
    header: 'TTL (seconds)',
    body: (
      <p>
        The amount of time, in seconds, that DNS recursive resolvers cache information about this
        record. Recommended values are 60 to 172800 (two days).
      </p>
    ),
  },
  routingPolicy: {
    header: 'Routing policy',
    body: (
      <>
        <p>The routing policy determines how Route 53 responds to queries.</p>
        <p>
          Weighted, latency, failover and multivalue answer records need a record ID that is unique
          among records with the same name and type. Geolocation, geoproximity and IP-based routing
          aren&apos;t available in this console clone.
        </p>
      </>
    ),
  },
  importZoneFile: {
    header: 'Import zone file',
    body: (
      <p>
        Paste a zone file in BIND format, or upload one. The SOA and NS records at the apex are
        skipped, because Route 53 creates its own. Review the preview, then choose <b>Import</b>;
        all records are imported in one change batch.
      </p>
    ),
  },
  comingSoon: {
    header: 'Coming soon',
    body: (
      <p>
        This part of the Route 53 console isn&apos;t available in this clone yet. Hosted zones and
        records are fully functional.
      </p>
    ),
  },
} satisfies Record<string, HelpTopic>;

export type HelpKey = keyof typeof TOPICS;

export function HelpContent({ helpKey }: { helpKey: HelpKey }) {
  const topic: HelpTopic = TOPICS[helpKey];
  return (
    <HelpPanel header={<h2>{topic.header}</h2>} footer={learnMore}>
      <Box variant="div">{topic.body}</Box>
    </HelpPanel>
  );
}
