'use client';

import Link from '@cloudscape-design/components/link';

import type { HelpKey } from '@/components/common/help-content';
import { useConsole } from '@/lib/console';

/** The "Info" link next to headings and fields; opens the matching help panel. */
export function InfoLink({ helpKey, label }: { helpKey: HelpKey; label?: string }) {
  const { openHelp } = useConsole();
  return (
    <Link
      variant="info"
      ariaLabel={label ? `Information about ${label}` : undefined}
      onFollow={() => openHelp(helpKey)}
    >
      Info
    </Link>
  );
}
