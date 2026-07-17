import { appSettings, type ThemeMode } from '../lib/settings';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getAdaptiveTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const hour = new Date().getHours();
  return (hour >= 7 && hour < 20) ? 'light' : 'dark';
}

function applyTheme() {
  if (typeof document === 'undefined') return;
  const unsub = appSettings.subscribe(s => {
    const body = document.body;
    let resolved: 'light' | 'dark';

    if (s.themeMode === 'adaptive') {
      resolved = getAdaptiveTheme();
    } else if (s.themeMode === 'system') {
      resolved = getSystemTheme();
    } else {
      resolved = s.themeMode;
    }

    body.classList.remove('light', 'dark', 'oled');
    if (s.oled && resolved === 'dark') {
      body.classList.add('oled');
    } else {
      body.classList.add(resolved);
    }

    if (s.accentColor) {
      body.style.setProperty('--accent', s.accentColor);
      body.style.setProperty('--accent-hover', s.accentColor + 'cc');
    } else {
      body.style.removeProperty('--accent');
      body.style.removeProperty('--accent-hover');
    }
  });
  return unsub;
}

export const applyThemeEffect = applyTheme;
