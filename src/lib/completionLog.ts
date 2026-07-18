import type { CompletionLog, CompletionAction } from '../types';
import type { Habit } from '../types';

const STORAGE_KEY = 'completionLogs';

export function loadLogs(): CompletionLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveLogs(logs: CompletionLog[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {}
}

export async function addLog(habitId: string, action: CompletionAction): Promise<void> {
  const logs = loadLogs();
  let latitude: number | undefined;
  let longitude: number | undefined;
  try {
    const pos = await getCurrentLocation();
    if (pos) { latitude = pos.coords.latitude; longitude = pos.coords.longitude; }
  } catch {}
  logs.push({
    id: crypto.randomUUID(),
    habitId,
    timestamp: new Date().toISOString(),
    action,
    latitude,
    longitude,
  });
  saveLogs(logs.slice(-500));
}

export function getCurrentTimeSlot(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function getCurrentLocation(timeout = 5000): Promise<GeolocationPosition | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos),
      () => resolve(null),
      { timeout, maximumAge: 600000 }
    );
  });
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dlat = toRad(lat2 - lat1);
  const dlon = toRad(lon2 - lon1);
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeSuggestions(habits: Habit[], time?: Date, position?: GeolocationPosition | null, maxAgeDays = 30): Habit[] {
  if (!position) return [];
  const now = time ?? new Date();
  const cutoff = new Date(now.getTime() - maxAgeDays * 86400000);
  const logs = loadLogs().filter(l => new Date(l.timestamp) >= cutoff);
  const scores = new Map<string, number>();

  for (const habit of habits) {
    let bestScore = 0;
    const habitLogs = logs.filter(l => l.habitId === habit.id);

    for (const log of habitLogs) {
      if (log.latitude == null || log.longitude == null) continue;

      const logTime = new Date(log.timestamp);
      const diffMin = Math.abs((now.getTime() - logTime.getTime()) / 60000);
      if (diffMin > 60) continue;

      const dist = haversine(position.coords.latitude, position.coords.longitude, log.latitude, log.longitude);
      if (dist > 100) continue;

      const timeScore = Math.max(0, 10 * (1 - diffMin / 60));
      const distScore = Math.max(0, 15 * (1 - dist / 100));
      const entryScore = timeScore + distScore;
      if (entryScore > bestScore) bestScore = entryScore;
    }

    if (bestScore > 0) scores.set(habit.id, bestScore);
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => habits.find(h => h.id === id)!)
    .filter(Boolean);
}
