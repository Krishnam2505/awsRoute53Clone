'use client';

/**
 * The console shell (AppLayout) lives in the route53/v2 layout. Pages describe
 * themselves to it through this context: breadcrumbs, content type, the help
 * panel topic, the split panel and their keyboard shortcuts.
 */
import type { AppLayoutProps } from '@cloudscape-design/components/app-layout';
import { type ReactNode, createContext, useContext, useEffect, useRef } from 'react';

import type { HelpKey } from '@/components/common/help-content';

export interface Crumb {
  text: string;
  href: string;
}

export interface PageConfig {
  breadcrumbs: Crumb[];
  contentType?: AppLayoutProps.ContentType;
  helpKey?: HelpKey;
}

export interface SplitPanelConfig {
  header: string;
  content: ReactNode;
  actions?: ReactNode;
}

export interface ShortcutHandlers {
  create?: () => void;
  refresh?: () => void;
}

export interface ConsoleApi {
  setPage: (config: PageConfig) => void;
  openHelp: (key: HelpKey) => void;
  setSplitPanel: (panel: SplitPanelConfig | null) => void;
  setSplitPanelOpen: (open: boolean) => void;
  registerShortcuts: (handlers: ShortcutHandlers) => () => void;
  openShortcutsHelp: () => void;
}

export const ConsoleContext = createContext<ConsoleApi | null>(null);

export function useConsole(): ConsoleApi {
  const context = useContext(ConsoleContext);
  if (!context) throw new Error('useConsole must be used inside the console shell');
  return context;
}

/** Declare this page's breadcrumbs, layout type and default help topic. */
export function usePageSetup(config: PageConfig): void {
  const { setPage } = useConsole();
  const key = JSON.stringify(config);
  useEffect(() => {
    setPage(JSON.parse(key) as PageConfig);
  }, [key, setPage]);
}

/** Register page-level keyboard shortcuts (c = create, r = refresh) while mounted. */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const { registerShortcuts } = useConsole();
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(
    () =>
      registerShortcuts({
        create: () => latest.current.create?.(),
        refresh: () => latest.current.refresh?.(),
      }),
    [registerShortcuts],
  );
}
