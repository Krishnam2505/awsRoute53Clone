import '@cloudscape-design/global-styles/index.css';
import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Route 53 Console',
  description:
    'A look-alike of the AWS Route 53 console for managing hosted zones and DNS records.',
  icons: { icon: '/console-logo.svg' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
