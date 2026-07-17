import { appSettings } from '../lib/settings';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getAdaptiveTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const hour = new Date().getHours();
  return (hour >= 7 && hour < 20) ? 'light' : 'dark';
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let r = 0, g = 0, b = 0;
  const h = hex.replace('#', '');
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
  } else if (h.length >= 6) {
    r = parseInt(h.substring(0, 2), 16);
    g = parseInt(h.substring(2, 4), 16);
    b = parseInt(h.substring(4, 6), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h$ = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h$ = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h$ = ((b - r) / d + 2) / 6; break;
      case b: h$ = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h$ * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function applyPalette(hue: number, isDark: boolean) {
  const body = document.body;
  if (isDark) {
    body.style.setProperty('--bg', `hsl(${hue}, 45%, 10%)`);
    body.style.setProperty('--text', `hsl(${hue}, 15%, 90%)`);
    body.style.setProperty('--text-primary', `hsl(${hue}, 15%, 90%)`);
    body.style.setProperty('--text-secondary', `hsl(${hue}, 10%, 65%)`);
    body.style.setProperty('--nav-bg', `hsl(${hue}, 40%, 15%)`);
    body.style.setProperty('--nav-border', `hsl(${hue}, 30%, 25%)`);
    body.style.setProperty('--card-bg', `hsl(${hue}, 40%, 15%)`);
    body.style.setProperty('--card-border', `hsl(${hue}, 30%, 25%)`);
    body.style.setProperty('--input-bg', `hsl(${hue}, 45%, 10%)`);
    body.style.setProperty('--input-border', `hsl(${hue}, 30%, 25%)`);
    body.style.setProperty('--btn-secondary-bg', `hsl(${hue}, 30%, 22%)`);
    body.style.setProperty('--slide-track', `hsl(${hue}, 30%, 25%)`);
    body.style.setProperty('--slide-thumb', `hsl(${hue}, 40%, 15%)`);
  } else {
    body.style.setProperty('--bg', `hsl(${hue}, 35%, 92%)`);
    body.style.setProperty('--text', `hsl(${hue}, 25%, 18%)`);
    body.style.setProperty('--text-primary', `hsl(${hue}, 25%, 18%)`);
    body.style.setProperty('--text-secondary', `hsl(${hue}, 20%, 45%)`);
    body.style.setProperty('--nav-bg', `hsl(${hue}, 30%, 88%)`);
    body.style.setProperty('--nav-border', `hsl(${hue}, 20%, 78%)`);
    body.style.setProperty('--card-bg', `#ffffff`);
    body.style.setProperty('--card-border', `hsl(${hue}, 20%, 78%)`);
    body.style.setProperty('--input-bg', `#ffffff`);
    body.style.setProperty('--input-border', `hsl(${hue}, 15%, 70%)`);
    body.style.setProperty('--btn-secondary-bg', `hsl(${hue}, 20%, 84%)`);
    body.style.setProperty('--slide-track', `hsl(${hue}, 20%, 78%)`);
    body.style.setProperty('--slide-thumb', `#ffffff`);
  }
}

function clearPalette() {
  const body = document.body;
  const props = [
    '--bg', '--text', '--text-primary', '--text-secondary',
    '--nav-bg', '--nav-border', '--card-bg', '--card-border',
    '--input-bg', '--input-border', '--btn-secondary-bg',
    '--slide-track', '--slide-thumb',
  ];
  for (const p of props) body.style.removeProperty(p);
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

    if (s.mainColor) {
      const { h } = hexToHsl(s.mainColor);
      applyPalette(h, resolved === 'dark');
    } else {
      clearPalette();
    }
  });
  return unsub;
}

export const applyThemeEffect = applyTheme;
