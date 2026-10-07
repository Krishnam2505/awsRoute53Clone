'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Spinner from '@cloudscape-design/components/spinner';

import { errorMessage } from '@/lib/api';
import { useFollow } from '@/lib/navigation';

interface Props {
  loading: boolean;
  error: unknown;
  what: string;
  backHref: string;
  backLabel: string;
}

/** Full-page loading spinner, or an error with a way back, for pages that load one resource. */
export function LoadingOrError({ loading, error, what, backHref, backLabel }: Props) {
  const onFollow = useFollow();
  if (loading) {
    return (
      <Box textAlign="center" padding="xxl" color="text-body-secondary">
        <Spinner size="large" />
        <Box variant="p">Loading {what}</Box>
      </Box>
    );
  }
  return (
    <Alert
      type="error"
      header={`Error loading ${what}`}
      action={
        <Button href={backHref} onFollow={onFollow}>
          {backLabel}
        </Button>
      }
    >
      {errorMessage(error)}
    </Alert>
  );
}
