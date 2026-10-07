'use client';

import { useCallback, useEffect, useState } from 'react';

/** A value remembered in localStorage (table page size, visible columns, …). */
export function useStoredState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) setValue({ ...initial, ...(JSON.parse(stored) as T) });
    } catch {
      // ignore unreadable storage
    }
    // initial is a constant default; reading storage once on mount is intended
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [key],
  );

  return [value, update];
}
