export interface TimerState {
  running: boolean;
  paused: boolean;
  elapsed: number;
  pausedElapsed: number;
  startedAt: number;
}

const cache = new Map<string, TimerState>();

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
  return cache.get(id) ?? loadFromStorage(id);
}

export function setTimerState(id: string, state: TimerState): void {
  cache.set(id, state);
  saveToStorage(id, state);
}

export function clearTimerState(id: string): void {
  cache.delete(id);
  removeFromStorage(id);
}
