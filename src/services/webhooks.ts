// src/services/webhooks.ts
import type { Habit, WebhookEvent } from '../types';

export type WebhookPayload = {
  event: WebhookEvent;
  habit: { id: string; title: string; type: string; unit?: string };
  date: string;
  value: number;
  standard: number;
  target: number | null;
  standardMet: boolean;
  targetMet: boolean;
  timestamp: string;
};

export type WebhookEventPayload = Omit<WebhookPayload, 'event' | 'habit'>;

// Event routing per habit type:
//  - binary:   'logged' (always) + 'completed' when the standard is met
//  - quantity / duration: 'logged' (always) + 'standard_met' + 'target_met'
export function webhooksFor(habit: Habit, value: number, standardMet: boolean, targetMet: boolean): WebhookEvent[] {
  const events: WebhookEvent[] = ['logged'];
  if (habit.type === 'binary') {
    if (standardMet) events.push('completed');
  } else {
    if (standardMet) events.push('standard_met');
    if (targetMet) events.push('target_met');
  }
  return events;
}

// Full payload body used by both webhooks and iOS Shortcuts.
export function buildBody(habit: Habit, event: WebhookEvent, payload: WebhookEventPayload): WebhookPayload {
  return {
    event,
    habit: { id: habit.id, title: habit.title, type: habit.type, unit: habit.unit },
    ...payload,
  };
}

// Debounce window: rapid repeat events on the same habit+event (e.g. tapping + three
// times) coalesce into a single invocation with the latest payload.
const DEBOUNCE_MS = 800;

const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; deliver: () => void }>();

function schedule(key: string, deliver: () => void) {
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    pending.delete(key);
    deliver();
  }, DEBOUNCE_MS);
  pending.set(key, { timer, deliver });
}

function interpolate(url: string, body: WebhookPayload): string {
  const lookup: Record<string, string> = {
    event: body.event,
    id: body.habit.id,
    habitId: body.habit.id,
    title: body.habit.title,
    type: body.habit.type,
    unit: body.habit.unit ?? '',
    date: body.date,
    value: String(body.value),
    standard: String(body.standard),
    target: body.target == null ? '' : String(body.target),
    standardMet: String(body.standardMet),
    targetMet: String(body.targetMet),
    timestamp: body.timestamp,
  };
  return url.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => encodeURIComponent(lookup[key] ?? ''));
}

function send(url: string, body: WebhookPayload) {
  void fetch(interpolate(url, body), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    // fire-and-forget; failures are intentionally silent
  });
}

export function fireWebhook(habit: Habit, event: WebhookEvent, payload: WebhookEventPayload): void {
  const url = habit.webhooks?.[event];
  if (!url) return;
  const body = buildBody(habit, event, payload);
  schedule(`${habit.id}|wh|${event}`, () => send(url, body));
}

// Runs an iOS Shortcut via a deep link. The full payload JSON (with the same
// interpolated values as the webhooks) is passed to the shortcut as URL-encoded text.
function openShortcut(name: string, body: WebhookPayload) {
  const url = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(JSON.stringify(body))}`;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function fireShortcut(habit: Habit, event: WebhookEvent, payload: WebhookEventPayload): void {
  const name = habit.shortcuts?.[event];
  if (!name) return;
  const body = buildBody(habit, event, payload);
  schedule(`${habit.id}|sc|${event}`, () => openShortcut(name, body));
}

// Fires the 'start' event (webhook + shortcut) when a duration timer begins.
export function fireHabitStart(habit: Habit, date: string, value: number): void {
  const payload: WebhookEventPayload = {
    date,
    value,
    standard: habit.standard,
    target: habit.target ?? null,
    standardMet: false,
    targetMet: false,
    timestamp: new Date().toISOString(),
  };
  fireWebhook(habit, 'start', payload);
  fireShortcut(habit, 'start', payload);
}
