'use client';

import { Mode, applyMode } from '@cloudscape-design/global-styles';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'r53-theme';

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // storage blocked: fall back to the OS setting
  }
  return 'system';
}

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** Applies Cloudscape's built-in dark or light mode and remembers the choice. */
export function applyThemePreference(preference: ThemePreference, remember = true): void {
  const dark = preference === 'dark' || (preference === 'system' && prefersDark());
  applyMode(dark ? Mode.Dark : Mode.Light);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  if (!remember) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // ignore
  }
}
