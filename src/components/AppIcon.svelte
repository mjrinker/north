<script lang="ts">
  let {
    mainColor = '#1a1a2e',
    accentColor = '#0066cc',
    size = 512,
  }: {
    mainColor?: string;
    accentColor?: string;
    size?: number;
  } = $props();

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
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16) / 255,
        g: parseInt(hex.substring(2, 4), 16) / 255,
        b: parseInt(hex.substring(4, 6), 16) / 255,
      };
    }
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16) / 255,
        g: parseInt(hex[1] + hex[1], 16) / 255,
        b: parseInt(hex[2] + hex[2], 16) / 255,
      };
    }
    return null;
  }

  function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
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

  function getContrast(color: string): string {
    const rgb = parseColor(color);
    if (!rgb) return '#ffffff';
    let { r, g, b } = rgb;
    r = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    g = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    b = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.179 ? '#000000' : '#ffffff';
  }

  const contrast = $derived(getContrast(mainColor));
  const mainHsl = $derived(rgbToHsl(...Object.values(parseColor(mainColor) || { r: 0.1, g: 0.1, b: 0.18 })));
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size}>
  <defs>
    <linearGradient id="icon-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl({mainHsl.h}, {Math.min(mainHsl.s + 5, 80)}%, {Math.max(mainHsl.l - 4, 4)}%)" />
      <stop offset="100%" stop-color="hsl({mainHsl.h}, {Math.max(mainHsl.s - 5, 10)}%, {Math.min(mainHsl.l + 8, 96)}%)" />
    </linearGradient>
  </defs>

  <rect width="512" height="512" rx={Math.round(512 * 0.18)} fill="url(#icon-bg)" />

  <path d="M 446 256 A 190 190 0 0 1 256 66" fill="none" stroke={contrast} stroke-width="34" stroke-linecap="round" />

  <path d="M 256 66 A 190 190 0 0 1 446 256" fill="none" stroke={accentColor} stroke-width="34" stroke-linecap="round" stroke-dasharray="2 24" />

  <path d="M 256 105 L 232 180 L 256 162 L 280 180 Z" fill={accentColor} />

  <text x="256" y="360" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="220" font-weight="700" fill={contrast}>N</text>
</svg>
