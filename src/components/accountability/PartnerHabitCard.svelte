<script lang="ts">
  import type { Habit } from '../../types';
  import { pluralizeUnit } from '$lib/units';
  import { formatDurationLabel } from '$lib/duration';
  import { progressPercentage } from '$lib/thresholds';
  import { habitColorVars } from '$lib/color';
  import Icon from '@iconify/svelte';

  // `sh.todayEntry` is the partner's entry for the date the parent page is viewing.
  let { sh }: { sh: any } = $props();

  let habit = $derived(sh.habit as Habit);
  let todayEntry = $derived(sh.todayEntry ?? null);
  let standardMet = $derived(sh.standardMet ?? false);
  let targetMet = $derived(sh.targetMet ?? false);
  let isBreakHabit = $derived(habit.metadata?.category === 'break');
  let unitLabel = $derived(habit.unit ? pluralizeUnit(habit.unit, Math.round(todayEntry?.value ?? 0)) : '');

  let value = $derived(todayEntry?.value ?? 0);
  let progress = $derived(habit.type === 'binary' ? (isBreakHabit ? (value === 1 ? 0 : 1) : (value === 1 ? 1 : 0)) : Math.min(1, progressPercentage(habit, value)));
  let goalText = $derived(habit.type === 'binary' ? '' : `${isBreakHabit ? 'Under' : 'Goal'} ${habit.type === 'duration' ? formatDurationLabel(habit.standard) : habit.standard}${habit.type === 'quantity' && habit.unit ? ' ' + pluralizeUnit(habit.unit, habit.standard) : ''}`);
  const RING_C = 2 * Math.PI * 17;

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

<div class="row partner-row" style={habitColorVars(habit.metadata?.color)}>
  <div class="glyph" aria-hidden="true">
    <svg class="ring" viewBox="0 0 40 40">
      <circle class="ring-track" cx="20" cy="20" r="17" />
      <circle class="ring-fill" cx="20" cy="20" r="17" stroke-dasharray={RING_C} stroke-dashoffset={RING_C * (1 - progress)} />
    </svg>
    {#if habit.metadata?.emoji}
      <span class="glyph-inner">{habit.metadata.emoji}</span>
    {:else if habit.metadata?.icon}
      <span class="glyph-inner"><Icon icon={habit.metadata.icon} /></span>
    {:else}
      <span class="glyph-inner initial">{habit.title.slice(0, 1).toUpperCase()}</span>
    {/if}
  </div>
  <div class="row-label">
    <div class="title">{habit.title}</div>
    {#if goalText}<div class="meta">{goalText}</div>{/if}
  </div>
  <div class="value tabular" class:met={standardMet} class:target={targetMet}>
    {#if habit.type === 'binary'}
      {#if isBreakHabit}
        <span class="check" class:break={value === 1}><Icon icon={value === 1 ? 'mdi:close' : 'mdi:check'} /></span>
      {:else if value === 1}
        <span class="check"><Icon icon="mdi:check" /></span>
      {:else}
        <span class="not-done">Not yet</span>
      {/if}
    {:else}
      {formatValue(todayEntry?.value)}{#if habit.type === 'quantity' && habit.unit}<span class="unit"> {unitLabel}</span>{/if}
    {/if}
  </div>
</div>

<style>
  .partner-row {
    min-height: 64px;
  }

  .glyph {
    position: relative;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    color: var(--habit-ink);
  }

  .ring {
    position: absolute;
    inset: 0;
    transform: rotate(-90deg);
  }

  .ring circle {
    fill: none;
    stroke-width: 3;
  }

  .ring-track { stroke: color-mix(in srgb, var(--habit) 16%, transparent); }
  .ring-fill { stroke: var(--habit-ink); stroke-linecap: round; }

  .glyph-inner {
    font-size: 18px;
    line-height: 1;
    display: grid;
  }

  .glyph-inner.initial {
    font-size: 15px;
    font-weight: 600;
  }

  .title {
    font-size: var(--text-md);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    font-size: var(--text-sm);
    color: var(--text-2);
  }

  .value {
    font-size: var(--text-md);
    font-weight: 600;
    color: var(--text-2);
  }

  .value.met { color: var(--text); }
  .value.target { color: var(--success); }

  .unit {
    font-size: var(--text-sm);
    font-weight: 400;
    color: var(--text-2);
  }

  .check {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--habit);
    color: var(--habit-on);
    font-size: 18px;
  }

  .check.break { background: var(--danger); color: #fff; }

  .not-done {
    font-size: var(--text-sm);
    font-weight: 400;
    color: var(--text-3);
  }
</style>
