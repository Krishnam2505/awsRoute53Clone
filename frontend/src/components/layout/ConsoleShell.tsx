'use client';

import AppLayout, { type AppLayoutProps } from '@cloudscape-design/components/app-layout';
import Flashbar from '@cloudscape-design/components/flashbar';
import SplitPanel from '@cloudscape-design/components/split-panel';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type HelpKey, HelpContent } from '@/components/common/help-content';
import {
  type ConsoleApi,
  ConsoleContext,
  type PageConfig,
  type ShortcutHandlers,
  type SplitPanelConfig,
} from '@/lib/console';
import { useMe } from '@/lib/api';
import { useFlashbarItems } from '@/lib/notifications';

import { Breadcrumbs } from './Breadcrumbs';
import { ConsoleHeader } from './ConsoleHeader';
import { Route53SideNav } from './Route53SideNav';
import { ShortcutsModal } from './ShortcutsModal';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function anyModalOpen(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

/** Top bar + AppLayout + side navigation + Flashbar + help panel, built once. */
export function ConsoleShell({ children }: { children: ReactNode }) {
  useMe(); // fills the account menu; a 401 sends the user to /login
  const flashItems = useFlashbarItems();
  const [page, setPage] = useState<PageConfig>({ breadcrumbs: [] });
  const [helpKey, setHelpKey] = useState<HelpKey>('hostedZones');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [splitPanel, setSplitPanel] = useState<SplitPanelConfig | null>(null);
  const [splitPanelOpen, setSplitPanelOpen] = useState(false);
  const [splitPanelSize, setSplitPanelSize] = useState(320);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const shortcuts = useRef<ShortcutHandlers>({});

  const api = useMemo<ConsoleApi>(
    () => ({
      setPage: (config) => {
        setPage(config);
        if (config.helpKey) setHelpKey(config.helpKey);
      },
      openHelp: (key) => {
        setHelpKey(key);
        setToolsOpen(true);
      },
      setSplitPanel,
      setSplitPanelOpen,
      registerShortcuts: (handlers) => {
        shortcuts.current = handlers;
        return () => {
          if (shortcuts.current === handlers) shortcuts.current = {};
        };
      },
      openShortcutsHelp: () => setShortcutsOpen(true),
    }),
    [],
  );

  // Global shortcuts: / search, c create, r refresh, ? help. Ignored while typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target) || anyModalOpen()) return;
      if (event.key === '/') {
        const input = document.querySelector<HTMLInputElement>('[data-shortcut-search] input');
        if (input) {
          event.preventDefault();
          input.focus();
        }
      } else if (event.key === 'c' && shortcuts.current.create) {
        event.preventDefault();
        shortcuts.current.create();
      } else if (event.key === 'r' && shortcuts.current.refresh) {
        event.preventDefault();
        shortcuts.current.refresh();
      } else if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onNavigationChange: AppLayoutProps['onNavigationChange'] = ({ detail }) =>
    setNavigationOpen(detail.open);

  return (
    <ConsoleContext.Provider value={api}>
      <div id="console-header" className="console-header">
        <ConsoleHeader onOpenShortcuts={useCallback(() => setShortcutsOpen(true), [])} />
      </div>
      <AppLayout
        headerSelector="#console-header"
        navigation={<Route53SideNav />}
        navigationOpen={navigationOpen}
        onNavigationChange={onNavigationChange}
        breadcrumbs={page.breadcrumbs.length ? <Breadcrumbs items={page.breadcrumbs} /> : undefined}
        notifications={<Flashbar items={flashItems} />}
        stickyNotifications
        contentType={page.contentType ?? 'default'}
        tools={<HelpContent helpKey={helpKey} />}
        toolsOpen={toolsOpen}
        onToolsChange={({ detail }) => setToolsOpen(detail.open)}
        splitPanel={
          splitPanel ? (
            <SplitPanel header={splitPanel.header} hidePreferencesButton closeBehavior="hide">
              {splitPanel.actions}
              {splitPanel.content}
            </SplitPanel>
          ) : undefined
        }
        splitPanelOpen={splitPanel !== null && splitPanelOpen}
        onSplitPanelToggle={({ detail }) => setSplitPanelOpen(detail.open)}
        splitPanelSize={splitPanelSize}
        onSplitPanelResize={({ detail }) => setSplitPanelSize(detail.size)}
        splitPanelPreferences={{ position: 'bottom' }}
        content={children}
      />
      <ShortcutsModal visible={shortcutsOpen} onDismiss={() => setShortcutsOpen(false)} />
    </ConsoleContext.Provider>
  );
}
