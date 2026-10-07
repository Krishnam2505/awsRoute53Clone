'use client';

/**
 * Flashbar context: notify.success() / notify.error() from anywhere in the console.
 * Banners survive one navigation when `persist` is set (create a zone, land on its
 * page, see the green banner), and are dropped on the navigation after that.
 */
import type { FlashbarProps } from '@cloudscape-design/components/flashbar';
import { usePathname } from 'next/navigation';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface NotifyOptions {
  header?: ReactNode;
  /** Keep the banner across the next page navigation. */
  persist?: boolean;
  action?: ReactNode;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  content: ReactNode;
  header?: ReactNode;
  action?: ReactNode;
  persist: boolean;
}

export interface Notifier {
  success: (content: ReactNode, options?: NotifyOptions) => void;
  error: (content: ReactNode, options?: NotifyOptions) => void;
  info: (content: ReactNode, options?: NotifyOptions) => void;
  clear: () => void;
}

interface NotificationsContextValue {
  notify: Notifier;
  items: FlashbarProps.MessageDefinition[];
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const counter = useRef(0);
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  // On navigation, drop banners that were not asked to persist; persisted ones get one hop
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    setNotifications((current) =>
      current.filter((n) => n.persist).map((n) => ({ ...n, persist: false })),
    );
  }, [pathname]);

  const push = useCallback(
    (type: Notification['type'], content: ReactNode, options: NotifyOptions = {}) => {
      counter.current += 1;
      const id = `flash-${counter.current}`;
      setNotifications((current) => [
        {
          id,
          type,
          content,
          header: options.header,
          action: options.action,
          persist: !!options.persist,
        },
        ...current.slice(0, 4),
      ]);
    },
    [],
  );

  const notify = useMemo<Notifier>(
    () => ({
      success: (content, options) => push('success', content, options),
      error: (content, options) => push('error', content, options),
      info: (content, options) => push('info', content, options),
      clear: () => setNotifications([]),
    }),
    [push],
  );

  const items = useMemo<FlashbarProps.MessageDefinition[]>(
    () =>
      notifications.map((n) => ({
        id: n.id,
        type: n.type,
        header: n.header,
        content: n.content,
        action: n.action,
        dismissible: true,
        dismissLabel: 'Dismiss message',
        onDismiss: () => setNotifications((current) => current.filter((x) => x.id !== n.id)),
      })),
    [notifications],
  );

  const value = useMemo(() => ({ notify, items }), [notify, items]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

function useNotificationsContext(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotify must be used inside NotificationsProvider');
  return context;
}

export function useNotify(): Notifier {
  return useNotificationsContext().notify;
}

export function useFlashbarItems(): FlashbarProps.MessageDefinition[] {
  return useNotificationsContext().items;
}
