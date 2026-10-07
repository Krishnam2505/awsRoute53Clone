import type { ReactNode } from 'react';

import { ConsoleShell } from '@/components/layout/ConsoleShell';

/** Console shell: header + AppLayout + side nav + Flashbar, shared by every Route 53 page. */
export default function Route53Layout({ children }: { children: ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
