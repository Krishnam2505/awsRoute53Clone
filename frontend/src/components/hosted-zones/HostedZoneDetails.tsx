'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Tabs from '@cloudscape-design/components/tabs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { InfoLink } from '@/components/common/InfoLink';
import { RecordsTable } from '@/components/records/RecordsTable';
import { TestRecordModal } from '@/components/records/TestRecordModal';
import { ApiError, errorMessage, useHostedZone } from '@/lib/api';
import type { HostedZoneDetail } from '@/lib/api/types';
import { usePageSetup } from '@/lib/console';
import { displayName, formatDateTime } from '@/lib/format';
import { useFollow } from '@/lib/navigation';
import { useNotify } from '@/lib/notifications';
import { useStoredState } from '@/lib/preferences';
import { regionLabel } from '@/lib/route53';
import { useUrlState } from '@/lib/use-url-state';

import { DeleteZoneModal } from './DeleteZoneModal';
import { HostedZoneTags } from './HostedZoneTags';

const BASE = '/route53/v2/hostedzones';

function DetailsPanel({ zone }: { zone: HostedZoneDetail }) {
  const onFollow = useFollow();
  const [expanded, setExpanded] = useStoredState('r53-zone-details', { open: false });

  const items = [
    { label: 'Hosted zone name', value: displayName(zone.name) },
    {
      label: 'Hosted zone ID',
      value: (
        <CopyToClipboard
          variant="inline"
          textToCopy={zone.id}
          copyButtonAriaLabel="Copy hosted zone ID"
          copySuccessText="Hosted zone ID copied"
          copyErrorText="Hosted zone ID failed to copy"
        />
      ),
    },
    { label: 'Description', value: zone.description || '-' },
    { label: 'Query log', value: '-' },
    {
      label: 'Type',
      value: zone.type === 'private' ? 'Private hosted zone' : 'Public hosted zone',
    },
    { label: 'Record count', value: zone.record_count },
    {
      label: 'Name servers',
      info: <InfoLink helpKey="nameServers" label="Name servers" />,
      value: (
        <SpaceBetween size="xxxs">
          {zone.name_servers.map((server) => (
            <CopyToClipboard
              key={server}
              variant="inline"
              textToCopy={server}
              copyButtonAriaLabel={`Copy ${server}`}
              copySuccessText="Name server copied"
              copyErrorText="Name server failed to copy"
            />
          ))}
        </SpaceBetween>
      ),
    },
    ...(zone.type === 'private'
      ? [
          {
            label: 'VPCs',
            value: (
              <SpaceBetween size="xxxs">
                {zone.vpcs.map((vpc) => (
                  <Box key={`${vpc.region}-${vpc.vpc_id}`}>
                    {vpc.vpc_id}{' '}
                    <Box variant="span" color="text-body-secondary">
                      ({regionLabel(vpc.region)})
                    </Box>
                  </Box>
                ))}
              </SpaceBetween>
            ),
          },
        ]
      : []),
    { label: 'Created', value: formatDateTime(zone.created_at) },
    { label: 'Last updated', value: formatDateTime(zone.updated_at) },
  ];

  return (
    <ExpandableSection
      variant="container"
      headerText="Hosted zone details"
      expanded={expanded.open}
      onChange={({ detail }) => setExpanded({ open: detail.expanded })}
      headerActions={
        <Button href={`${BASE}/${zone.id}/edit`} onFollow={onFollow}>
          Edit hosted zone
        </Button>
      }
    >
      <KeyValuePairs columns={3} items={items} />
    </ExpandableSection>
  );
}

function DnssecTab() {
  return (
    <Container
      header={
        <Header
          variant="h2"
          description="DNSSEC signing protects your domain from DNS spoofing and man-in-the-middle attacks."
          actions={<Button disabled>Enable DNSSEC signing</Button>}
        >
          DNSSEC signing
        </Header>
      }
    >
      <KeyValuePairs
        columns={2}
        items={[
          {
            label: 'Signing status',
            value: <StatusIndicator type="stopped">Not signing</StatusIndicator>,
          },
          { label: 'Availability', value: 'Coming soon in this Route 53 console clone' },
        ]}
      />
    </Container>
  );
}

export function HostedZoneDetails({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const notify = useNotify();
  const url = useUrlState();
  const query = useHostedZone(zoneId);
  const zone = query.data;
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);

  usePageSetup({
    breadcrumbs: [
      { text: 'Hosted zones', href: BASE },
      { text: zone ? displayName(zone.name) : zoneId, href: `${BASE}/${zoneId}` },
    ],
    contentType: 'default',
    helpKey: 'zoneDetails',
  });

  if (query.isLoading) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" /> <Box variant="span">Loading hosted zone</Box>
      </Box>
    );
  }
  if (query.isError || !zone) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <ContentLayout header={<Header variant="h1">Hosted zone</Header>}>
        <Alert
          type="error"
          header={missing ? 'Hosted zone not found' : 'Error loading hosted zone'}
          action={<Button onClick={() => router.push(BASE)}>Go to hosted zones</Button>}
        >
          {errorMessage(query.error)}
        </Alert>
      </ContentLayout>
    );
  }

  const tab = url.get('tab') || 'records';
  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          info={<InfoLink helpKey="zoneDetails" label="hosted zone" />}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => setDeleting(true)}>Delete zone</Button>
              <Button onClick={() => setTesting(true)}>Test record</Button>
              <Button
                onClick={() =>
                  notify.info("Query logging isn't available in this Route 53 console clone yet.")
                }
              >
                Configure query logging
              </Button>
            </SpaceBetween>
          }
        >
          {displayName(zone.name)}
        </Header>
      }
    >
      <SpaceBetween size="l">
        <DetailsPanel zone={zone} />
        <Tabs
          activeTabId={tab}
          onChange={({ detail }) =>
            url.set({ tab: detail.activeTabId === 'records' ? undefined : detail.activeTabId })
          }
          tabs={[
            {
              id: 'records',
              label: `Records (${zone.record_count})`,
              content: <RecordsTable zone={zone} />,
            },
            { id: 'dnssec', label: 'DNSSEC signing', content: <DnssecTab /> },
            {
              id: 'tags',
              label: `Hosted zone tags (${zone.tags.length})`,
              content: <HostedZoneTags zone={zone} />,
            },
          ]}
        />
      </SpaceBetween>
      <DeleteZoneModal
        zone={deleting ? zone : null}
        onDismiss={() => setDeleting(false)}
        onDeleted={() => router.push(BASE)}
      />
      <TestRecordModal zone={zone} visible={testing} onDismiss={() => setTesting(false)} />
    </ContentLayout>
  );
}
