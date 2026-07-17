import { writable, type Writable } from 'svelte/store';

export type ThemeMode = 'light' | 'dark' | 'system' | 'adaptive';
export type LaunchScreen = '/today' | '/history' | '/stats' | '/settings';

export interface AppSettings {
  resetTime: string;
  themeMode: ThemeMode;
  oled: boolean;
  accentColor: string;
  mainColor: string;
  launchScreen: LaunchScreen;
}

const STORAGE_KEY = 'appSettings';

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return { ...defaults };
}

function save(settings: AppSettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
}

const defaults: AppSettings = {
  resetTime: '00:00',
  themeMode: 'system',
  oled: false,
  accentColor: '',
  mainColor: '',
  launchScreen: '/today',
};

function createSettingsStore(): Writable<AppSettings> & { init: () => void } {
  const store = writable<AppSettings>(load());
  let initialized = false;
  return {
    ...store,
    init() {
      if (initialized) return;
      initialized = true;
      store.subscribe(v => save(v));
    },
  };
}

export const appSettings = createSettingsStore();
