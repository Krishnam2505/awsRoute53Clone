'use client';

import { I18nProvider } from '@cloudscape-design/components/i18n';
import enMessages from '@cloudscape-design/components/i18n/messages/all.en';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';

import { ApiError } from '@/lib/api/client';
import { NotificationsProvider } from '@/lib/notifications';
import { applyThemePreference, readThemePreference } from '@/lib/theme';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        // Don't retry what will fail the same way again
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    applyThemePreference(readThemePreference(), false);
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (readThemePreference() === 'system') applyThemePreference('system', false);
    };
    media?.addEventListener('change', onChange);
    return () => media?.removeEventListener('change', onChange);
  }, []);

  return (
    <I18nProvider locale="en" messages={[enMessages]}>
      <QueryClientProvider client={queryClient}>
        <NotificationsProvider>{children}</NotificationsProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
