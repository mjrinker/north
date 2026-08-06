// src/services/webhooks.ts
import type { Habit, WebhookEvent } from '../types';

export type WebhookPayload = {
  event: WebhookEvent;
  habit: { id: string; title: string; type: string };
  date: string;
  value: number;
  standard: number;
  target: number | null;
  standardMet: boolean;
  targetMet: boolean;
  timestamp: string;
};

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

// Debounce window: rapid repeat events on the same habit+event (e.g. tapping + three
// times) coalesce into a single webhook call with the latest payload.
const DEBOUNCE_MS = 800;

const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; url: string; body: WebhookPayload }>();

function send(url: string, body: WebhookPayload) {
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    // fire-and-forget; failures are intentionally silent
  });
}

export function fireWebhook(habit: Habit, event: WebhookEvent, payload: Omit<WebhookPayload, 'event' | 'habit'>): void {
  const url = habit.webhooks?.[event];
  if (!url) return;
  const key = `${habit.id}|${event}`;
  const body: WebhookPayload = {
    event,
    habit: { id: habit.id, title: habit.title, type: habit.type },
    ...payload,
  };
  const existing = pending.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    existing.body = body;
    existing.timer = setTimeout(() => {
      pending.delete(key);
      send(url, body);
    }, DEBOUNCE_MS);
    return;
  }
  const rec = { url, body, timer: undefined as unknown as ReturnType<typeof setTimeout> };
  pending.set(key, rec);
  rec.timer = setTimeout(() => {
    pending.delete(key);
    send(url, body);
  }, DEBOUNCE_MS);
}