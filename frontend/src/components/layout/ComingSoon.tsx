'use client';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';

import { InfoLink } from '@/components/common/InfoLink';
import { type Crumb, usePageSetup } from '@/lib/console';
import { useFollow } from '@/lib/navigation';

interface Props {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
}

/** Placeholder for console sections outside this clone's scope, inside the real shell. */
export function ComingSoon({ title, description, breadcrumbs }: Props) {
  const onFollow = useFollow();
  usePageSetup({
    breadcrumbs: breadcrumbs ?? [{ text: title, href: '#' }],
    contentType: 'default',
    helpKey: 'comingSoon',
  });
  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          info={<InfoLink helpKey="comingSoon" label={title} />}
          description={description}
        >
          {title}
        </Header>
      }
    >
      <Container>
        <Box textAlign="center" padding={{ vertical: 'xxl' }}>
          <SpaceBetween size="m">
            <Box variant="h2" tagOverride="p">
              Coming soon
            </Box>
            <Box variant="p" color="text-body-secondary">
              {title} isn&apos;t available in this Route 53 console clone yet. Hosted zones and DNS
              records are fully functional.
            </Box>
            <Button href="/route53/v2/hostedzones" onFollow={onFollow}>
              Go to hosted zones
            </Button>
          </SpaceBetween>
        </Box>
      </Container>
    </ContentLayout>
  );
}
