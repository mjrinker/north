import { writable } from 'svelte/store';

export interface TimerState {
  running: boolean;
  paused: boolean;
  elapsed: number;
  pausedElapsed: number;
  startedAt: number;
}

export const defaultTimer: TimerState = {
  running: false, paused: false, elapsed: 0, pausedElapsed: 0, startedAt: 0
};

export interface AllTimers {
  [habitId: string]: TimerState;
}

function loadAllFromStorage(): AllTimers {
  try {
    const saved = localStorage.getItem('__allTimerStates');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveAllToStorage(all: AllTimers): void {
  try {
    localStorage.setItem('__allTimerStates', JSON.stringify(all));
  } catch {}
}

const initial = loadAllFromStorage();
export const timerStates = writable<AllTimers>(initial);

// Persist on every change
timerStates.subscribe(all => {
  saveAllToStorage(all);
});

export function setTimerState(id: string, state: TimerState): void {
  timerStates.update(all => ({ ...all, [id]: state }));
}

export function clearTimerState(id: string): void {
  timerStates.update(all => {
    const next = { ...all };
    delete next[id];
    return next;
  });
}
