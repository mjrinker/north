export interface TimerState {
  running: boolean;
  paused: boolean;
  elapsed: number;
  pausedElapsed: number;
  startedAt: number;
}

const WIN_KEY = '__timerCache';

function getCache(): Map<string, TimerState> {
  if (typeof window === 'undefined') return new Map();
  if (!(window as any)[WIN_KEY]) {
    (window as any)[WIN_KEY] = new Map();
  }
  return (window as any)[WIN_KEY];
}

function storageKey(id: string): string {
  return `timer_${id}`;
}

function loadFromStorage(id: string): TimerState | null {
  try {
    const saved = localStorage.getItem(storageKey(id));
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function saveToStorage(id: string, state: TimerState): void {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(state));
  } catch {}
}

function removeFromStorage(id: string): void {
  try {
    localStorage.removeItem(storageKey(id));
  } catch {}
}

export function getTimerState(id: string): TimerState | null {
  const cached = getCache().get(id);
  if (cached) return cached;
  const stored = loadFromStorage(id);
  if (stored) {
    getCache().set(id, stored);
    return stored;
  }
  return null;
}

export function setTimerState(id: string, state: TimerState): void {
  getCache().set(id, state);
  saveToStorage(id, state);
}

export function clearTimerState(id: string): void {
  getCache().delete(id);
  removeFromStorage(id);
}
