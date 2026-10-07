'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';

import { InfoLink } from '@/components/common/InfoLink';
import { useHostedZones } from '@/lib/api';
import { usePageSetup } from '@/lib/console';
import { useFollow } from '@/lib/navigation';

function ComingSoonTile({ title, description }: { title: string; description: string }) {
  return (
    <Container header={<Header variant="h2">{title}</Header>} fitHeight>
      <SpaceBetween size="s">
        <Box variant="p" color="text-body-secondary">
          {description}
        </Box>
        <Box color="text-status-inactive">Coming soon</Box>
      </SpaceBetween>
    </Container>
  );
}

/** Dashboard: placeholder tiles plus a live DNS management tile, like the real dashboard. */
export function Dashboard() {
  const onFollow = useFollow();
  const zones = useHostedZones({ page: 1, page_size: 1 });
  usePageSetup({
    breadcrumbs: [{ text: 'Dashboard', href: '/route53/v2/home' }],
    contentType: 'default',
    helpKey: 'dashboard',
  });

  const count = zones.data?.total;
  return (
    <ContentLayout
      header={
        <Header variant="h1" info={<InfoLink helpKey="dashboard" label="Dashboard" />}>
          Route 53 Dashboard
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Alert type="info">
          The full Route 53 dashboard is coming soon. DNS management (hosted zones and records) is
          fully available.
        </Alert>
        <ColumnLayout columns={2}>
          <Container
            fitHeight
            header={
              <Header
                variant="h2"
                actions={
                  <Button href="/route53/v2/hostedzones/create" onFollow={onFollow}>
                    Create hosted zone
                  </Button>
                }
              >
                DNS management
              </Header>
            }
          >
            <SpaceBetween size="s">
              <Box variant="awsui-value-large">
                {count === undefined ? (
                  <Spinner />
                ) : (
                  <Link
                    variant="awsui-value-large"
                    href="/route53/v2/hostedzones"
                    onFollow={onFollow}
                  >
                    {count}
                  </Link>
                )}
              </Box>
              <Box>{count === 1 ? 'Hosted zone' : 'Hosted zones'}</Box>
            </SpaceBetween>
          </Container>
          <ComingSoonTile
            title="Traffic management"
            description="Create traffic policies to route traffic across multiple endpoints."
          />
          <ComingSoonTile
            title="Availability monitoring"
            description="Monitor the health of your resources with health checks."
          />
          <ComingSoonTile
            title="Domain registration"
            description="Register and transfer domain names."
          />
        </ColumnLayout>
      </SpaceBetween>
    </ContentLayout>
  );
}
