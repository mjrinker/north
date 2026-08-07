import { writable, get, type Writable } from 'svelte/store';
import { pushRecord } from '../services/sync';

export type ThemeMode = 'light' | 'dark' | 'system' | 'adaptive';
export type LaunchScreen = '/today' | '/history' | '/stats' | '/settings';

export interface AppSettings {
  resetTime: string;
  themeMode: ThemeMode;
  oled: boolean;
  accentColor: string;
  mainColor: string;
  launchScreen: LaunchScreen;
  habitOrder: string[];
}

const STORAGE_KEY = 'appSettings';

export const defaultSettings: AppSettings = {
  resetTime: '00:00',
  themeMode: 'system',
  oled: false,
  accentColor: '',
  mainColor: '',
  launchScreen: '/today',
  habitOrder: [],
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {}
  return { ...defaultSettings };
}

function save(settings: AppSettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
}

function createSettingsStore(): Writable<AppSettings> & { init: () => void } {
  const store = writable<AppSettings>(load());
  let initialized = false;
  return {
    subscribe: store.subscribe,
    set: store.set,
    update: store.update,
    init() {
      if (initialized) return;
      initialized = true;
      store.subscribe(v => save(v));
    },
  };
}

export const appSettings = createSettingsStore();

export function updateSettings(partial: Partial<AppSettings>) {
  appSettings.update(v => ({ ...v, ...partial }));
  pushRecord('settings', 'app_settings', get(appSettings));
}
