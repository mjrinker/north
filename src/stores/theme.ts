import { writable, type Writable } from 'svelte/store';

type ThemeMode = 'light' | 'dark' | 'system';

function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const body = document.body;
  body.classList.remove('light', 'dark', 'system');
  body.classList.add(theme);
}

export const theme: Writable<ThemeMode> = writable(getSystemTheme());

theme.subscribe((val) => { applyTheme(val); });

export const showModal: Writable<boolean> = writable(false);

export type { ThemeMode };