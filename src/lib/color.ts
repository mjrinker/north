// Contrast helpers for user-chosen colors (habit colors, accent).

function parseHex(color: string): [number, number, number] | null {
  const h = color.trim().replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(h)) return [0, 1, 2].map(i => parseInt(h[i] + h[i], 16) / 255) as [number, number, number];
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  return null;
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const DARK_INK = '#1c1b1a';
const DARK_INK_LUM = luminance(parseHex(DARK_INK)!);

// Foreground (white or near-black) that reads best on a solid `background`.
// Falls back to white for colors it can't parse (e.g. CSS variables).
export function readableOn(background: string | undefined | null): string {
  const rgb = background ? parseHex(background) : null;
  if (!rgb) return '#ffffff';
  const l = luminance(rgb);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (DARK_INK_LUM + 0.05);
  return onWhite >= onDark ? '#ffffff' : DARK_INK;
}

// Inline style vars for anything drawn in a habit's color:
//   --habit     the color itself (fills, tracks)
//   --habit-on  icon/text color on top of a --habit fill
//   --habit-ink the color nudged toward the text color, for icons/text/marks
//               drawn on normal surfaces (darker in light mode, lighter in dark)
export function habitColorVars(color: string | undefined | null): string {
  const base = color || 'var(--accent)';
  const on = color ? readableOn(color) : 'var(--accent-contrast)';
  return `--habit: ${base}; --habit-on: ${on}; --habit-ink: color-mix(in oklab, ${base} 60%, var(--text));`;
}
