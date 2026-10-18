import { appSettings } from '../lib/settings';

export function resolveThemeMode(mode: 'light' | 'dark' | 'system' | 'adaptive'): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (mode === 'adaptive') {
    if (typeof window === 'undefined') return 'light';
    const hour = new Date().getHours();
    return (hour >= 7 && hour < 20) ? 'light' : 'dark';
  }
  return mode;
}

function getSystemTheme(): 'light' | 'dark' {
  return resolveThemeMode('system');
}

function getAdaptiveTheme(): 'light' | 'dark' {
  return resolveThemeMode('adaptive');
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

// Tints the neutral surfaces toward the user's main color. Saturation stays
// low so any hue keeps the quiet look; `mainLightness` nudges how deep the
// tint goes.
const PALETTE_PROPS = ['--bg', '--surface', '--surface-2', '--surface-3', '--text', '--text-2', '--text-3'];

function applyPalette(hue: number, mainLightness: number, isDark: boolean, isOled: boolean) {
  const body = document.body;
  const depth = 1 - mainLightness / 100; // darker main color => stronger tint
  const sat = Math.round(8 + depth * 14);
  const set = (k: string, v: string) => body.style.setProperty(k, v);
  if (isOled) {
    set('--bg', '#000000');
    set('--surface', `hsl(${hue}, ${sat}%, 6%)`);
    set('--surface-2', `hsl(${hue}, ${sat}%, 11%)`);
    set('--surface-3', `hsl(${hue}, ${sat}%, 16%)`);
  } else if (isDark) {
    set('--bg', `hsl(${hue}, ${sat}%, 7%)`);
    set('--surface', `hsl(${hue}, ${sat}%, 11%)`);
    set('--surface-2', `hsl(${hue}, ${sat}%, 16%)`);
    set('--surface-3', `hsl(${hue}, ${sat}%, 21%)`);
    set('--text', `hsl(${hue}, 8%, 93%)`);
    set('--text-2', `hsl(${hue}, 6%, 64%)`);
    set('--text-3', `hsl(${hue}, 5%, 45%)`);
  } else {
    set('--bg', `hsl(${hue}, ${sat}%, 95%)`);
    set('--surface', `hsl(${hue}, ${Math.round(sat / 2)}%, 99.5%)`);
    set('--surface-2', `hsl(${hue}, ${sat}%, 91%)`);
    set('--surface-3', `hsl(${hue}, ${sat}%, 87%)`);
    set('--text', `hsl(${hue}, 12%, 11%)`);
    set('--text-2', `hsl(${hue}, 6%, 41%)`);
    set('--text-3', `hsl(${hue}, 5%, 60%)`);
  }
}

function clearPalette() {
  for (const p of PALETTE_PROPS) document.body.style.removeProperty(p);
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
    let resolved = resolveThemeMode(s.themeMode);

    const isOled = s.oled && resolved === 'dark';

    body.classList.remove('light', 'dark', 'oled');
    if (isOled) {
      body.classList.add('oled');
    } else {
      body.classList.add(resolved);
    }

    if (s.accentColor) {
      body.style.setProperty('--accent', s.accentColor);
      body.style.setProperty('--accent-contrast', getContrastText(s.accentColor));
    } else {
      body.style.removeProperty('--accent');
      body.style.removeProperty('--accent-contrast');
    }

    if (s.mainColor) {
      const { h, l } = hexToHsl(s.mainColor);
      applyPalette(h, l, resolved === 'dark', isOled);
    } else {
      clearPalette();
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(body).getPropertyValue('--bg').trim() || '#f4f3f1');
  });
  return unsub;
}

export const applyThemeEffect = applyTheme;
