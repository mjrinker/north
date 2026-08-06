// src/lib/duration.ts
// Duration values are stored everywhere as whole seconds. These helpers convert
// to/from the hh:mm:ss forms used by the UI.

export function hmsFromSeconds(total: number): { h: number; m: number; s: number } {
  const t = Math.max(0, Math.floor(total || 0));
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// "h:mm:ss" when >= 1h, otherwise "mm:ss".
export function formatHms(total: number): string {
  const { h, m, s } = hmsFromSeconds(total);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Parses "hh:mm:ss", "mm:ss", "ss", or a bare number of seconds. Returns NaN for
// unparseable input. A 1-2 part colon string is treated as minutes(:seconds).
export function parseHms(input: string): number {
  const text = String(input ?? '').trim();
  if (!text) return NaN;
  const parts = text.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return NaN;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + (s ?? 0);
}

// Compact label like "5m", "1h 20m" for table cells and unit display.
export function formatDurationLabel(total: number): string {
  const { h, m } = hmsFromSeconds(total);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}