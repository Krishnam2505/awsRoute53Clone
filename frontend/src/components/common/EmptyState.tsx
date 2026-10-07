import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/** The centred "No hosted zones" / "No matches" block used inside tables. */
export function EmptyState({ title, subtitle, action }: Props) {
  return (
    <Box textAlign="center" color="inherit" padding={{ vertical: 's' }}>
      <SpaceBetween size="xxs">
        <Box variant="strong" color="inherit">
          {title}
        </Box>
        {subtitle && (
          <Box variant="p" color="inherit">
            {subtitle}
          </Box>
        )}
      </SpaceBetween>
      {action && <Box margin={{ top: 's' }}>{action}</Box>}
    </Box>
  );
}
