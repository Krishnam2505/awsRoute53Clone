'use client';

import { I18nProvider } from '@cloudscape-design/components/i18n';
import enMessages from '@cloudscape-design/components/i18n/messages/all.en';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { ApiError, errorMessage } from '@/lib/api/client';
import { NotificationsProvider, type Notifier, useNotify } from '@/lib/notifications';
import { applyThemePreference, readThemePreference } from '@/lib/theme';

function makeQueryClient(onMutationError: (error: unknown) => void): QueryClient {
  return new QueryClient({
    // Every failed create, edit or delete also ends in a red Flashbar banner
    mutationCache: new MutationCache({ onError: onMutationError }),
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

function QueryProvider({ children }: { children: ReactNode }) {
  const notify = useNotify();
  const notifyRef = useRef<Notifier>(notify);
  notifyRef.current = notify;
  const [queryClient] = useState(() =>
    makeQueryClient((error) => {
      // An expired session redirects to sign-in instead
      if (error instanceof ApiError && error.status === 401) return;
      notifyRef.current.error(errorMessage(error), {
        header: error instanceof ApiError ? error.code : 'Error',
      });
    }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
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
      <NotificationsProvider>
        <QueryProvider>{children}</QueryProvider>
      </NotificationsProvider>
    </I18nProvider>
  );
}
