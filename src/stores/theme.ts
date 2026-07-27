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

function parseColor(color: string): { r: number; g: number; b: number } | null {
  const h = color.trim();
  const hslMatch = h.match(/^hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)$/);
  if (hslMatch) {
    const h$ = parseInt(hslMatch[1]) / 360;
    const s = parseInt(hslMatch[2]) / 100;
    const l = parseInt(hslMatch[3]) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h$ * 12) % 12;
      return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    return { r: f(0), g: f(8), b: f(4) };
  }
  const hex = h.replace('#', '');
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16) / 255,
      g: parseInt(hex[1] + hex[1], 16) / 255,
      b: parseInt(hex[2] + hex[2], 16) / 255,
    };
  }
  if (hex.length >= 6) {
    return {
      r: parseInt(hex.substring(0, 2), 16) / 255,
      g: parseInt(hex.substring(2, 4), 16) / 255,
      b: parseInt(hex.substring(4, 6), 16) / 255,
    };
  }
  return null;
}

function hexToHsl(color: string): { h: number; s: number; l: number } {
  const rgb = parseColor(color);
  if (!rgb) return { h: 0, s: 0, l: 50 };
  let { r, g, b } = rgb;
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

function applyPalette(hue: number, mainLightness: number, isDark: boolean, isOled: boolean) {
  const body = document.body;
  const f = mainLightness / 100;
  if (isOled) {
    body.style.setProperty('--bg', `#000000`);
    body.style.setProperty('--text', `hsl(${hue}, 15%, 90%)`);
    body.style.setProperty('--text-primary', `hsl(${hue}, 15%, 90%)`);
    body.style.setProperty('--text-secondary', `hsl(${hue}, 10%, 60%)`);
    body.style.setProperty('--nav-bg', `hsl(${hue}, 40%, ${4 + f * 6}%)`);
    body.style.setProperty('--nav-border', `hsl(${hue}, 30%, ${8 + f * 6}%)`);
    body.style.setProperty('--card-bg', `hsl(${hue}, 40%, ${5 + f * 6}%)`);
    body.style.setProperty('--card-border', `hsl(${hue}, 30%, ${10 + f * 6}%)`);
    body.style.setProperty('--input-bg', `#000000`);
    body.style.setProperty('--input-border', `hsl(${hue}, 30%, ${10 + f * 6}%)`);
    body.style.setProperty('--btn-secondary-bg', `hsl(${hue}, 30%, ${8 + f * 6}%)`);
    body.style.setProperty('--slide-track', `hsl(${hue}, 30%, ${10 + f * 6}%)`);
    body.style.setProperty('--slide-thumb', `hsl(${hue}, 40%, ${5 + f * 6}%)`);
    body.style.setProperty('--dep-popover-bg', `#000000`);
    body.style.setProperty('--dep-popover-text', `hsl(${hue}, 15%, 90%)`);
    body.style.setProperty('--dep-popover-border', `hsl(${hue}, 30%, ${6 + f * 4}%)`);
    body.style.setProperty('--dep-popover-muted', `hsl(${hue}, 10%, 50%)`);
    return;
  }
  if (isDark) {
    const bgL = 5 + f * 15;
    const textL = 80 + f * 15;
    const navL = 8 + f * 15;
    const cardL = 8 + f * 15;
    const borderL = 15 + f * 15;
    const btnL = 12 + f * 15;
    body.style.setProperty('--bg', `hsl(${hue}, 45%, ${bgL}%)`);
    body.style.setProperty('--text', `hsl(${hue}, 15%, ${textL}%)`);
    body.style.setProperty('--text-primary', `hsl(${hue}, 15%, ${textL}%)`);
    body.style.setProperty('--text-secondary', `hsl(${hue}, 10%, ${textL - 20}%)`);
    body.style.setProperty('--nav-bg', `hsl(${hue}, 40%, ${navL}%)`);
    body.style.setProperty('--nav-border', `hsl(${hue}, 30%, ${borderL}%)`);
    body.style.setProperty('--card-bg', `hsl(${hue}, 40%, ${cardL}%)`);
    body.style.setProperty('--card-border', `hsl(${hue}, 30%, ${borderL}%)`);
    body.style.setProperty('--input-bg', `hsl(${hue}, 45%, ${bgL}%)`);
    body.style.setProperty('--input-border', `hsl(${hue}, 30%, ${borderL}%)`);
    body.style.setProperty('--btn-secondary-bg', `hsl(${hue}, 30%, ${btnL}%)`);
    body.style.setProperty('--slide-track', `hsl(${hue}, 30%, ${borderL}%)`);
    body.style.setProperty('--slide-thumb', `hsl(${hue}, 40%, ${cardL}%)`);
    body.style.setProperty('--dep-popover-bg', `hsl(${hue}, 40%, ${bgL}%)`);
    body.style.setProperty('--dep-popover-text', `hsl(${hue}, 15%, ${textL}%)`);
    body.style.setProperty('--dep-popover-border', `hsl(${hue}, 30%, ${borderL - 5}%)`);
    body.style.setProperty('--dep-popover-muted', `hsl(${hue}, 10%, ${textL - 30}%)`);
  } else {
    const bgL = 70 + f * 25;
    const textL = 10 + f * 20;
    const navL = 65 + f * 25;
    const borderL = 60 + f * 25;
    const btnL = 60 + f * 25;
    body.style.setProperty('--bg', `hsl(${hue}, 35%, ${bgL}%)`);
    body.style.setProperty('--text', `hsl(${hue}, 25%, ${textL}%)`);
    body.style.setProperty('--text-primary', `hsl(${hue}, 25%, ${textL}%)`);
    body.style.setProperty('--text-secondary', `hsl(${hue}, 20%, ${textL + 30}%)`);
    body.style.setProperty('--nav-bg', `hsl(${hue}, 30%, ${navL}%)`);
    body.style.setProperty('--nav-border', `hsl(${hue}, 20%, ${borderL}%)`);
    body.style.setProperty('--card-bg', `#ffffff`);
    body.style.setProperty('--card-border', `hsl(${hue}, 20%, ${borderL}%)`);
    body.style.setProperty('--input-bg', `#ffffff`);
    body.style.setProperty('--input-border', `hsl(${hue}, 15%, ${borderL - 10}%)`);
    body.style.setProperty('--btn-secondary-bg', `hsl(${hue}, 20%, ${btnL}%)`);
    body.style.setProperty('--slide-track', `hsl(${hue}, 20%, ${borderL}%)`);
    body.style.setProperty('--slide-thumb', `#ffffff`);
    body.style.setProperty('--dep-popover-bg', `#ffffff`);
    body.style.setProperty('--dep-popover-text', `hsl(${hue}, 25%, ${textL}%)`);
    body.style.setProperty('--dep-popover-border', `hsl(${hue}, 15%, ${borderL - 10}%)`);
    body.style.setProperty('--dep-popover-muted', `hsl(${hue}, 20%, ${textL + 30}%)`);
  }
}

function clearPalette() {
  const body = document.body;
  const props = [
    '--bg', '--text', '--text-primary', '--text-secondary',
    '--nav-bg', '--nav-border', '--card-bg', '--card-border',
    '--input-bg', '--input-border', '--btn-secondary-bg',
    '--slide-track', '--slide-thumb',
    '--dep-popover-bg', '--dep-popover-text', '--dep-popover-border', '--dep-popover-muted',
  ];
  for (const p of props) body.style.removeProperty(p);
}

function getContrastText(color: string): string {
  const rgb = parseColor(color);
  if (!rgb) return '#ffffff';
  let { r, g, b } = rgb;
  r = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  g = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  b = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.179 ? '#000000' : '#ffffff';
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

    const isOled = s.oled && resolved === 'dark';

    body.classList.remove('light', 'dark', 'oled');
    if (isOled) {
      body.classList.add('oled');
    } else {
      body.classList.add(resolved);
    }

    if (s.accentColor) {
      body.style.setProperty('--accent', s.accentColor);
      body.style.setProperty('--accent-hover', s.accentColor + 'cc');
      body.style.setProperty('--accent-text', getContrastText(s.accentColor));
    } else {
      body.style.removeProperty('--accent');
      body.style.removeProperty('--accent-hover');
      body.style.removeProperty('--accent-text');
    }

    if (s.mainColor) {
      const { h, l } = hexToHsl(s.mainColor);
      applyPalette(h, l, resolved === 'dark', isOled);
    } else {
      clearPalette();
    }
  });
  return unsub;
}

export const applyThemeEffect = applyTheme;
