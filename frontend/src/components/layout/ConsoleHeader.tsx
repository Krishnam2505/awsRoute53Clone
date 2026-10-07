'use client';

import Input from '@cloudscape-design/components/input';
import TopNavigation, {
  type TopNavigationProps,
} from '@cloudscape-design/components/top-navigation';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useLogout, useMe } from '@/lib/api';
import { formatAccountId } from '@/lib/format';
import { useNotify } from '@/lib/notifications';
import { type ThemePreference, applyThemePreference, readThemePreference } from '@/lib/theme';

interface Props {
  onOpenShortcuts: () => void;
}

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Browser default',
  light: 'Light',
  dark: 'Dark',
};

/** The dark console bar: logo, services, search, utilities, region and account menus. */
export function ConsoleHeader({ onOpenShortcuts }: Props) {
  const router = useRouter();
  const notify = useNotify();
  const { data: me } = useMe();
  const logout = useLogout();
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setTheme(readThemePreference()), []);

  // Alt+S focuses the unified search, as in the console
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.code === 'KeyS') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('#console-search input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const signOut = () => {
    // A full page load clears every cached query, so nothing refetches as a signed-out user
    logout.mutate(undefined, { onSettled: () => window.location.replace('/login') });
  };

  const chooseTheme = (preference: ThemePreference) => {
    setTheme(preference);
    applyThemePreference(preference);
  };

  const comingSoon = (what: string) =>
    notify.info(`${what} isn't available in this Route 53 console clone.`);

  const account = me ? formatAccountId(me.account_id) : '';
  const utilities: TopNavigationProps.Utility[] = [
    {
      type: 'button',
      iconName: 'command-prompt',
      ariaLabel: 'CloudShell',
      title: 'CloudShell',
      onClick: () => comingSoon('CloudShell'),
    },
    {
      type: 'button',
      iconName: 'notification',
      ariaLabel: 'Notifications',
      title: 'Notifications',
      onClick: () => comingSoon('Notifications'),
    },
    {
      type: 'menu-dropdown',
      iconName: 'support',
      ariaLabel: 'Support',
      title: 'Support',
      items: [
        {
          id: 'docs',
          text: 'Documentation',
          href: 'https://docs.aws.amazon.com/route53/',
          external: true,
        },
        { id: 'shortcuts', text: 'Keyboard shortcuts' },
      ],
      onItemClick: ({ detail }) => {
        if (detail.id === 'shortcuts') onOpenShortcuts();
      },
    },
    {
      type: 'menu-dropdown',
      iconName: 'settings',
      ariaLabel: 'Settings',
      title: 'Settings',
      items: [
        {
          id: 'theme',
          text: 'Visual mode',
          items: (['system', 'light', 'dark'] as const).map((value) => ({
            id: `theme-${value}`,
            text: THEME_LABELS[value],
            iconName: theme === value ? 'check' : undefined,
          })),
        },
        { id: 'shortcuts', text: 'Keyboard shortcuts' },
      ],
      onItemClick: ({ detail }) => {
        if (detail.id.startsWith('theme-')) chooseTheme(detail.id.slice(6) as ThemePreference);
        if (detail.id === 'shortcuts') onOpenShortcuts();
      },
    },
    {
      type: 'menu-dropdown',
      text: 'Global',
      title: 'Global',
      ariaLabel: 'Region: Global',
      items: [
        {
          id: 'global-note',
          text: 'Route 53 does not require region selection.',
          disabled: true,
        },
      ],
    },
    {
      type: 'menu-dropdown',
      text: me ? `${me.username} @ ${account}` : 'Account',
      ariaLabel: 'Account menu',
      title: me?.username,
      description: me ? `Account ID: ${account}` : undefined,
      items: [
        { id: 'account', text: 'Account' },
        { id: 'organization', text: 'Organization' },
        { id: 'quotas', text: 'Service Quotas' },
        { id: 'billing', text: 'Billing and Cost Management' },
        { id: 'credentials', text: 'Security credentials' },
        { id: 'signout', text: 'Sign out' },
      ],
      onItemClick: ({ detail }) => {
        if (detail.id === 'signout') signOut();
        else comingSoon('This account page');
      },
    },
  ];

  return (
    <TopNavigation
      identity={{
        href: '/route53/v2/home',
        title: 'Console',
        logo: { src: '/console-logo.svg', alt: 'Console home' },
        onFollow: (event) => {
          event.preventDefault();
          router.push('/route53/v2/home');
        },
      }}
      search={
        <div id="console-search" className="console-search">
          <Input
            ref={searchRef}
            type="search"
            value={search}
            placeholder="Search [Alt+S]"
            ariaLabel="Search"
            onChange={({ detail }) => setSearch(detail.value)}
            onKeyDown={({ detail }) => {
              if (detail.key === 'Enter' && search.trim()) {
                router.push(`/route53/v2/hostedzones?search=${encodeURIComponent(search.trim())}`);
              }
            }}
          />
        </div>
      }
      utilities={utilities}
    />
  );
}
