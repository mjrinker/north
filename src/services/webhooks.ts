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

export function fireWebhook(habit: Habit, event: WebhookEvent, payload: Omit<WebhookPayload, 'event' | 'habit'>): void {
  const url = habit.webhooks?.[event];
  if (!url) return;
  const body: WebhookPayload = {
    event,
    habit: { id: habit.id, title: habit.title, type: habit.type },
    ...payload,
  };
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    // fire-and-forget; failures are intentionally silent
  });
}