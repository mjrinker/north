<script lang="ts">
  import type { Habit } from '../../../types';
  import { getLocalDateString } from '$lib/dates';
  import { isStandardMet, isTargetMet } from '$lib/thresholds';
  import { pluralizeUnit } from '$lib/units';
  import Icon from '@iconify/svelte';

  let { sh, date = getLocalDateString() }: { sh: any; date?: string } = $props();

  let habit = sh.habit as Habit;
  let todayEntry = sh.todayEntry ?? null;
  let standardMet = sh.standardMet ?? false;
  let targetMet = sh.targetMet ?? false;
  let isBreakHabit = habit.metadata?.category === 'break';
  let unitLabel = habit.unit ? pluralizeUnit(habit.unit, Math.round(todayEntry?.value ?? 0)) : '';

  function formatValue(value: number | undefined): string {
    if (value === undefined || value === null) return '—';
    if (habit.type === 'duration') {
      const h = Math.floor(value / 3600);
      const m = Math.floor((value % 3600) / 60);
      const s = value % 60;
      if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      return `${m}:${String(s).padStart(2, '0')}`;
    }
    return String(Math.round(value));
  }
</script>

<div class="habit-card partner-card">
  <div class="partner-badge">Shared</div>

  <div class="card-main">
    <div class="habit-info">
      {#if habit.metadata?.emoji}
        <span class="habit-emoji">{habit.metadata.emoji}</span>
      {:else if habit.metadata?.icon}
        <Icon icon={habit.metadata.icon} class="habit-icon" />
      {/if}
      <div class="habit-text">
        <h3 class="habit-title">{habit.title}</h3>
        {#if habit.description}
          <p class="habit-desc">{habit.description}</p>
        {/if}
      </div>
    </div>

    <div class="habit-progress">
      {#if habit.type === 'binary'}
        <div class="binary-display" class:completed={todayEntry?.value === 1} class:break={isBreakHabit}>
          {#if todayEntry?.value === 1}
            <Icon icon={isBreakHabit ? 'mdi:close' : 'mdi:check'} size="32" />
          {:else}
            <Icon icon={isBreakHabit ? 'mdi:check' : 'mdi:minus'} size="32" />
          {/if}
        </div>
      {:else if habit.type === 'quantity'}
        <div class="quantity-display" class:standard-met={standardMet} class:target-met={targetMet}>
          <span class="qty-value">{formatValue(todayEntry?.value)}</span>
          {#if habit.unit}
            <span class="qty-unit">{unitLabel}</span>
          {/if}
        </div>
      {:else if habit.type === 'duration'}
        <div class="duration-display" class:standard-met={standardMet} class:target-met={targetMet}>
          <span class="dur-value">{formatValue(todayEntry?.value)}</span>
        </div>
      {/if}

      <div class="progress-badges">
        {#if standardMet}
          <span class="badge standard">Standard Met</span>
        {/if}
        {#if targetMet}
          <span class="badge target">Target Met</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="habit-meta">
    <span class="meta-item">
      <Icon icon="mdi:calendar-clock" size="14" />
      {habit.schedule.frequency === 'daily' ? 'Daily' : habit.schedule.frequency}
    </span>
    {#if habit.metadata?.category}
      <span class="meta-item category">{habit.metadata.category}</span>
    {/if}
  </div>
</div>

<style>
  .partner-card {
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 12px;
    padding: 1rem;
    position: relative;
  }
  .partner-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: var(--accent, #0066cc);
    color: white;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .card-main { display: flex; gap: 1rem; align-items: flex-start; }
  .habit-info { flex: 1; min-width: 0; }
  .habit-emoji { font-size: 2rem; }
  .habit-icon { font-size: 2rem; color: var(--accent, #0066cc); }
  .habit-title { margin: 0 0 0.25rem; font-size: 1rem; font-weight: 600; color: var(--text-primary, #222); }
  .habit-desc { margin: 0; font-size: 0.8rem; color: var(--text-secondary, #666); line-height: 1.4; }
  .habit-progress { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
  .binary-display {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    color: white;
    background: var(--card-border, #ddd);
  }
  .binary-display.completed {
    background: #2e7d32;
  }
  .binary-display.break.completed {
    background: #e65100;
  }
  .quantity-display, .duration-display {
    font-size: 1.5rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text-primary, #222);
  }
  .quantity-display.standard-met, .duration-display.standard-met {
    color: #2e7d32;
  }
  .quantity-display.target-met, .duration-display.target-met {
    color: #1565c0;
  }
  .qty-unit { font-size: 0.75rem; font-weight: 400; color: var(--text-secondary, #666); margin-left: 0.25rem; }
  .progress-badges { display: flex; flex-wrap: wrap; gap: 0.25rem; justify-content: flex-end; }
  .badge {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .badge.standard { background: #e8f5e9; color: #2e7d32; }
  .badge.target { background: #e3f2fd; color: #1565c0; }
  .habit-meta {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--card-border, #e0e0e0);
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
  }
  .meta-item { display: inline-flex; align-items: center; gap: 0.25rem; }
  .meta-item.category {
    background: var(--accent, #0066cc);
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    font-weight: 600;
  }
</style>