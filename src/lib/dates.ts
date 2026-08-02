export function getLocalDateString(date?: Date): string {
  const d = date ? new Date(date) : new Date();
  const now = date ?? new Date();
  const resetTime = getStoredResetTime();
  if (resetTime) {
    const [h, m] = resetTime.split(':').map(Number);
    const resetMinutes = h * 60 + m;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (currentMinutes < resetMinutes) {
      d.setDate(d.getDate() - 1);
    }
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStoredResetTime(): string | null {
  try {
    const raw = localStorage.getItem('appSettings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.resetTime) return parsed.resetTime;
    }
  } catch {}
  return null;
}

export function getWeekStart(d: Date, startOfWeek: number = 1): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day - startOfWeek + 7) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Plain local YYYY-MM-DD (no reset-time shift)
export function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isToday(date: string): boolean {
  return date === getLocalDateString();
}
