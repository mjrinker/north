<script lang="ts">
  import type { Habit } from '../types';
  import { HabitEngine } from '../services/habitEngine';
  import { getEntry } from '../services/storage';
  import { habitsStore } from '../stores/habits';
  import { getLocalDateString } from '../lib/dates';
  import { isStandardMet as metStandard, isTargetMet as metTarget, progressPercentage } from '../lib/thresholds';
  import { formatDurationLabel } from '../lib/duration';
  import { timerStates, setTimerState, clearTimerState, defaultTimer, type TimerState, type AllTimers } from '../lib/timerStore';
  import { recordAutoCompletedDep } from '../lib/autoDeps';
  import { autoCompleteDependencies, uncheckDependencies } from '../lib/dependencyEngine';
  import { entriesStore } from '../stores/entries';
  import { onDestroy } from 'svelte';
  import { tick as svelteTick } from 'svelte';
  import Icon from '@iconify/svelte';
  import { pluralizeUnit } from '../lib/units';
  import { fireHabitStart } from '../services/webhooks';
  import { marked } from 'marked';
  import type { DepPopoverState } from '../types';
  let { habit, date = getLocalDateString(), onEdit, onNotes, notesCount, onDepPopover, isFirst = false, isLast = false }: { habit: Habit; date?: string; onEdit?: () => void; onNotes?: () => void; notesCount?: number; onDepPopover?: (state: DepPopoverState) => void; isFirst?: boolean; isLast?: boolean } = $props();
  let showNotes = $state(false);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressFired = $state(false);

  let allHabits = $state<Habit[]>([]);
  habitsStore.subscribe(v => allHabits = v);

  let streak = $state(0);
  let todayEntry = $state<{ value: number; standardMet: boolean; targetMet: boolean; _v: number } | null>(null);
  let entryVersion = $state(0);
  let trigger = $state(0);
  entriesStore.subscribe(() => trigger++);
  let _gen = 0;

  let autoCompleted = $state(new Set<string>());
  let isAutoCompleted = $derived(habit.dependsOn ? autoCompleted.has(habit.id + '|' + date) : false);
  let isStandardMet = $derived(todayEntry ? metStandard(habit, todayEntry.value) : false);
  let isTargetMet = $derived(todayEntry && habit.target != null ? metTarget(habit, todayEntry.value) : false);
  let isBreakHabit = $derived(habit.metadata?.category === 'break');
  let unitLabel = $derived(habit.unit ? pluralizeUnit(habit.unit, Math.round(todayEntry?.value ?? 0)) : '');
  let depResults = $state<{ hid: string; met: boolean }[]>([]);


  function openDepPopover(e: Event) {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    onDepPopover?.({
      habitId: habit.id,
      style: `top:${rect.bottom + 6 + window.scrollY}px; left:${rect.left + window.scrollX}px;`,
      mode: habit.dependsOn!.mode,
      deps: depResults.map(r => ({
        hid: r.hid,
        name: allHabits.find(h => h.id === r.hid)?.title ?? 'Unknown',
        met: r.met,
      })),
    });
  }

  $effect(() => {
    if (!habit) return;
    const _ = trigger;
    const gen = ++_gen;
    const key = habit.id + '|' + date;
    (async () => {
      try {
        const entry = await getEntry(habit.id, date);
        if (_gen !== gen) return;
        if (entry) {
          todayEntry = { value: entry.value, standardMet: entry.standardMet, targetMet: entry.targetMet, _v: entryVersion };
        } else {
          todayEntry = null;
        }
        if (habit.type === 'binary' && habit.dependsOn && date === getLocalDateString()) {
          const results = await Promise.all(
            habit.dependsOn!.habitIds.map(async hid => {
              const e = await getEntry(hid, date);
              const dep = allHabits.find(h => h.id === hid);
              return { hid, met: e && dep ? metStandard(dep, e.value) : false };
            })
          );
          depResults = results;
          if (_gen !== gen) return;
          const satisfied = habit.dependsOn!.mode === 'and'
            ? results.every(r => r.met)
            : results.some(r => r.met);
          const value = entry?.value ?? 0;
          if (satisfied && value === 0) {
            for (const r of depResults) {
              if (!r.met) continue;
              const e = await getEntry(r.hid, date);
              if (e && e.value > 0) continue;
              recordAutoCompletedDep(habit.id, date, r.hid);
            }
            autoCompleted.add(key);
            await HabitEngine.logCompletion(habit, date, 1);
            todayEntry = { value: 1, standardMet: metStandard(habit, 1), targetMet: habit.target != null && metTarget(habit, 1), _v: entryVersion++ };
          } else if (!satisfied && value === 1) {
            await HabitEngine.logCompletion(habit, date, 0);
            autoCompleted.delete(key);
            todayEntry = { value: 0, standardMet: false, targetMet: false, _v: entryVersion++ };
          }
          if (todayEntry?.value === 0) {
            autoCompleted.delete(key);
          }
        }
        if (_gen !== gen) return;
        streak = await HabitEngine.getStreak(habit);
      } catch (e) {
        console.error('Habit effect error:', e);
      }
    })();
  });

  // Timer state — store-backed
  let allTimerStates = $state<AllTimers>({});
  let unsubTimer = timerStates.subscribe(v => allTimerStates = v);
  let timerState = $derived(allTimerStates[habit.id] ?? defaultTimer);
  let timerHrs = $derived(Math.floor(timerState.elapsed / 3600));
  let timerMins = $derived(Math.floor((timerState.elapsed % 3600) / 60));
  let timerSecs = $derived(timerState.elapsed % 60);
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let manualSeconds = $state('');

  // Ring fill: share of the standard reached (binary = done or not).
  let liveValue = $derived(habit.type === 'duration' && timerState.running ? timerState.elapsed : (todayEntry?.value ?? 0));
  let progress = $derived.by(() => {
    if (habit.type === 'binary') return todayEntry?.value === 1 && !isBreakHabit ? 1 : 0;
    if (isBreakHabit) return todayEntry ? Math.min(1, progressPercentage(habit, liveValue)) : 0;
    return Math.min(1, progressPercentage(habit, liveValue));
  });
  let slipped = $derived(isBreakHabit && todayEntry != null && !metStandard(habit, todayEntry.value) && (habit.type !== 'binary' || todayEntry.value === 1));
  const RING_C = 2 * Math.PI * 17;

  let progressText = $derived.by(() => {
    if (habit.type === 'binary') return '';
    const fmt = (v: number) => habit.type === 'duration' ? formatDurationLabel(v) : String(Math.round(v));
    if (isBreakHabit) return `Under ${fmt(habit.standard)}`;
    const unit = habit.type === 'quantity' && habit.unit ? ` ${pluralizeUnit(habit.unit, habit.standard)}` : '';
    return `Goal ${fmt(habit.standard)}${unit}`;
  });

  $effect(() => {
    if (timerState.running && !timerState.paused && timerState.startedAt > 0) {
      if (!timerInterval) startTimerInterval();
    }
  });

  onDestroy(() => {
    unsubTimer();
    clearTimerInterval();
  });

  function tick() {
    const s = allTimerStates[habit.id];
    if (!s) return;
    if (!s.running || s.paused || s.startedAt === 0) {
      // A stray interval (e.g. from a still-mounted timer in the log modal)
      // must not keep accumulating with startedAt=0, which produces
      // now-since-epoch. Self-cancel instead.
      clearTimerInterval();
      return;
    }
    const newElapsed = s.pausedElapsed + Math.floor((Date.now() - s.startedAt) / 1000);
    setTimerState(habit.id, { ...s, elapsed: newElapsed });
  }

  function startTimer() {
    const initial = manualSeconds ? parseInt(manualSeconds) : (todayEntry?.value ?? 0);
    const startSec = (isNaN(initial) ? 0 : initial);
    setTimerState(habit.id, { running: true, paused: false, elapsed: startSec, pausedElapsed: startSec, startedAt: Date.now() });
    startTimerInterval();
    manualSeconds = '';
    fireHabitStart(habit, date, startSec);
  }

  function pauseTimer() {
    clearTimerInterval();
    const s = allTimerStates[habit.id];
    if (!s) return;
    setTimerState(habit.id, { ...s, paused: true, pausedElapsed: s.elapsed, startedAt: 0 });
  }

  function resumeTimer() {
    const s = allTimerStates[habit.id];
    if (!s) return;
    setTimerState(habit.id, { ...s, paused: false, startedAt: Date.now() });
    startTimerInterval();
  }

  function doneTimer() {
    const s = allTimerStates[habit.id];
    if (!s) return;
    clearTimerInterval();
    const seconds = s.elapsed;
    clearTimerState(habit.id);
    logAndRefresh(seconds);
  }

  function cancelTimer() {
    clearTimerInterval();
    clearTimerState(habit.id);
  }

  async function handleDurationSet(hours: number, minutes: number, seconds: number) {
    if (!habit) return;
    await logAndRefresh(hours * 3600 + minutes * 60 + seconds);
  }

  let durTotalSec = $derived(Math.round(todayEntry?.value ?? 0));
  let durHours = $derived(Math.floor(durTotalSec / 3600));
  let durMinutes = $derived(Math.floor((durTotalSec % 3600) / 60));
  let durSeconds = $derived(durTotalSec % 60);

  function saveDurInputs(e: Event) {
    const wrap = (e.currentTarget as HTMLElement).closest('.dur-input-wrap')!;
    const inputs = wrap.querySelectorAll<HTMLInputElement>('.dur-input');
    const vals = [...inputs].map(i => parseInt(i.value) || 0);
    let h = 0, m = 0, s = 0;
    if (vals.length === 3) { h = vals[0]; m = vals[1]; s = vals[2]; }
    else { m = vals[0]; s = vals[1]; }
    handleDurationSet(h, m, s);
  }

  async function handleReset() {
    await logAndRefresh(0);
  }

  async function logAndRefresh(value: number) {
    if (todayEntry) {
      todayEntry.value = value;
      todayEntry.standardMet = metStandard(habit, value);
      todayEntry.targetMet = habit.target != null && metTarget(habit, value);
      todayEntry._v = ++entryVersion;
    } else {
      todayEntry = {
        value,
        standardMet: metStandard(habit, value),
        targetMet: habit.target != null && metTarget(habit, value),
        _v: ++entryVersion,
      };
    }
    try { await HabitEngine.logCompletion(habit, date, value); } catch (e) { console.error('logCompletion error:', e); }
  }

  function clearTimerInterval() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function useNoteClick(node: HTMLElement) {
    function handler(e: Event) {
      e.stopPropagation();
      longPressFired = true;
      onNotes?.();
    }
    node.addEventListener('click', handler);
    return { destroy: () => node.removeEventListener('click', handler) };
  }
  function useLongPressStart(node: HTMLElement) {
    function onStart() {
      longPressFired = false;
      longPressTimer = setTimeout(() => {
        longPressFired = true;
        onNotes?.();
      }, 500);
    }
    function onEnd() {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    }
    node.addEventListener('mousedown', onStart);
    node.addEventListener('mouseup', onEnd);
    node.addEventListener('mouseleave', onEnd);
    node.addEventListener('touchstart', onStart, { passive: true });
    node.addEventListener('touchend', onEnd);
    node.addEventListener('touchmove', onEnd);
    return {
      destroy: () => {
        node.removeEventListener('mousedown', onStart);
        node.removeEventListener('mouseup', onEnd);
        node.removeEventListener('mouseleave', onEnd);
        node.removeEventListener('touchstart', onStart);
        node.removeEventListener('touchend', onEnd);
        node.removeEventListener('touchmove', onEnd);
      }
    };
  }

  function startTimerInterval() {
    clearTimerInterval();
    timerInterval = setInterval(tick, 200);
  }

  async function handleBinaryChange() {
    if (!habit) return;
    try {
      const savedScrollY = window.scrollY;
      const wasChecked = todayEntry?.value === 1;
      const value = wasChecked ? 0 : 1;
      const getEntryFn = (hid: string, d: string) => getEntry(hid, d);
      if (value === 1 && habit.dependsOn) {
        await autoCompleteDependencies(habit, date, allHabits, getEntryFn);
      }
      if (wasChecked && habit.dependsOn) {
        await uncheckDependencies(habit, date, allHabits, getEntryFn);
      }
      await logAndRefresh(value);
      await svelteTick();
      window.scrollTo(0, savedScrollY);
    } catch (e) {
      console.error('handleBinaryChange error:', e);
    }
  }

  async function handleQuantityDelta(delta: number) {
    if (!habit) return;
    try {
      const current = todayEntry?.value ?? 0;
      await logAndRefresh(Math.max(0, current + delta));
    } catch (e) {
      console.error('handleQuantityDelta error:', e);
    }
  }

  async function handleQuantitySet(value: number) {
    if (!habit) return;
    try {
      await logAndRefresh(value);
    } catch (e) {
      console.error('handleQuantitySet error:', e);
    }
  }
</script>

<div class="habit-row" role="button" tabindex="0"
  style="--habit: {habit.metadata?.color || 'var(--accent)'};"
  use:useLongPressStart
  onclick={() => { if (!longPressFired) onEdit?.(); }}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit?.(); } }}>
  <div class="glyph" class:slipped aria-hidden="true">
    <svg class="ring" viewBox="0 0 40 40">
      <circle class="ring-track" cx="20" cy="20" r="17" />
      <circle class="ring-fill" cx="20" cy="20" r="17"
        stroke-dasharray={RING_C}
        stroke-dashoffset={RING_C * (1 - (slipped ? 1 : progress))} />
    </svg>
    {#if habit.metadata?.emoji}
      <span class="glyph-inner emoji">{habit.metadata.emoji}</span>
    {:else if habit.metadata?.icon}
      <span class="glyph-inner"><Icon icon={habit.metadata.icon} /></span>
    {:else}
      <span class="glyph-inner initial">{habit.title.slice(0, 1).toUpperCase()}</span>
    {/if}
  </div>

  <div class="body">
    <div class="title-line">
      <span class="title">{habit.title}</span>
      {#if habit.dependsOn && habit.dependsOn.habitIds.length > 0}
        <button class="dep-chip tabular" onclick={openDepPopover} aria-label="Show conditions">
          <Icon icon="mdi:link-variant" />{depResults.filter(r => r.met).length}/{depResults.length}
        </button>
      {/if}
    </div>
    <div class="meta">
      {#if progressText}<span>{progressText}</span>{/if}
      {#if streak > 0}
        <span class="meta-streak tabular" title="{streak} {habit.schedule.daysPerWeek ? 'week' : 'day'} streak"><Icon icon="mdi:fire" />{streak}{habit.schedule.daysPerWeek ? 'w' : ''}</span>
      {/if}
      {#if notesCount && notesCount > 0}
        <button class="meta-notes" use:useNoteClick aria-label="{notesCount} notes">
          <Icon icon="mdi:note-text-outline" />{notesCount}
        </button>
      {/if}
    </div>
    {#if habit.description}
      <div class="desc">{@html marked.parse(habit.description)}</div>
    {/if}
  </div>

  <div class="control" onclick={(e) => e.stopPropagation()} role="presentation">
    {#if habit.type === 'binary'}
      <label class="check" class:on={todayEntry?.value === 1} class:break={isBreakHabit} aria-label={todayEntry?.value === 1 ? 'Mark not done' : 'Mark done'}>
        <input type="checkbox" checked={todayEntry?.value === 1} onchange={handleBinaryChange} disabled={isAutoCompleted} onmousedown={(e) => e.preventDefault()} />
        {#if todayEntry?.value === 1}
          <Icon icon={isBreakHabit ? 'mdi:close' : 'mdi:check'} />
        {/if}
      </label>
    {:else if habit.type === 'quantity'}
      <div class="stepper">
        <button onclick={() => handleQuantityDelta(-1)} aria-label="Decrease" disabled={(todayEntry?.value ?? 0) <= 0}><Icon icon="mdi:minus" /></button>
        <input
          type="number"
          inputmode="numeric"
          value={todayEntry?.value ?? 0}
          min="0"
          class="stepper-value tabular"
          class:met={isStandardMet && !isBreakHabit}
          class:target={isTargetMet}
          class:over={slipped}
          aria-label="{habit.title} count"
          onfocus={(e) => {
            const target = e.currentTarget as HTMLInputElement;
            target.select();
          }}
          onkeydown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
          }}
          onblur={(e) => {
            const val = parseInt((e.currentTarget as HTMLInputElement).value);
            if (!isNaN(val) && val >= 0 && val !== (todayEntry?.value ?? 0)) handleQuantitySet(val);
          }}
        />
        <button onclick={() => handleQuantityDelta(1)} aria-label="Increase"><Icon icon="mdi:plus" /></button>
      </div>
    {:else if habit.type === 'duration'}
      <div class="timer">
        <div class="dur-input-wrap tabular" class:running={timerState.running} class:met={isStandardMet && !isBreakHabit} class:target={isTargetMet} class:over={slipped}>
          {#if (timerState.running ? timerHrs : durHours) > 0}
            <input type="text" inputmode="numeric" value={timerState.running ? timerHrs : durHours} class="dur-input" disabled={timerState.running} aria-label="Hours"
              onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
              onkeydown={(e) => { if (e.key === 'Enter') saveDurInputs(e); }}
              onblur={saveDurInputs} />
            <span class="dur-sep">:</span>
          {/if}
          <input type="text" inputmode="numeric" value={String(timerState.running ? timerMins : durMinutes).padStart(2, '0')} class="dur-input" disabled={timerState.running} aria-label="Minutes"
            onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
            onkeydown={(e) => { if (e.key === 'Enter') saveDurInputs(e); }}
            onblur={saveDurInputs} />
          <span class="dur-sep">:</span>
          <input type="text" inputmode="numeric" value={String(timerState.running ? timerSecs : durSeconds).padStart(2, '0')} class="dur-input" disabled={timerState.running} aria-label="Seconds"
            onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
            onkeydown={(e) => { if (e.key === 'Enter') saveDurInputs(e); }}
            onblur={saveDurInputs} />
        </div>
        {#if timerState.running}
          <button onclick={() => doneTimer()} class="round done" aria-label="Done"><Icon icon="mdi:check" /></button>
          {#if timerState.paused}
            <button onclick={() => resumeTimer()} class="round primary" aria-label="Resume"><Icon icon="mdi:play" /></button>
          {:else}
            <button onclick={() => pauseTimer()} class="round primary" aria-label="Pause"><Icon icon="mdi:pause" /></button>
          {/if}
        {:else}
          {#if todayEntry && todayEntry.value > 0}
            <button onclick={() => handleReset()} class="round subtle" aria-label="Reset to zero"><Icon icon="mdi:restore" /></button>
          {/if}
          <button onclick={() => startTimer()} class="round primary" aria-label="Start timer"><Icon icon="mdi:play" /></button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .habit-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 64px;
    padding: var(--space-3) var(--space-4);
    background: var(--surface);
    cursor: pointer;
    -webkit-touch-callout: none;
    transition: background 0.15s;
  }

  .habit-row:active {
    background: var(--surface-2);
  }

  /* Icon inside a progress ring drawn in the habit's color. */
  .glyph {
    position: relative;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    color: var(--habit);
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

  .ring-track {
    stroke: color-mix(in srgb, var(--habit) 16%, transparent);
  }

  .ring-fill {
    stroke: var(--habit);
    stroke-linecap: round;
    transition: stroke-dashoffset 0.4s var(--ease);
  }

  .glyph.slipped {
    color: var(--danger);
  }

  .glyph.slipped .ring-fill {
    stroke: var(--danger);
  }

  .glyph-inner {
    display: grid;
    place-items: center;
    font-size: 19px;
    line-height: 1;
  }

  .glyph-inner.emoji {
    font-size: 17px;
  }

  .glyph-inner.initial {
    font-size: 15px;
    font-weight: 600;
  }

  .body {
    flex: 1;
    min-width: 0;
  }

  .title-line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .title {
    font-size: var(--text-md);
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dep-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    height: 20px;
    padding: 0 6px;
    border-radius: 6px;
    background: var(--surface-2);
    color: var(--text-2);
    font-size: var(--text-xs);
    font-weight: 600;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: var(--space-3);
    margin-top: 1px;
    font-size: var(--text-sm);
    color: var(--text-2);
  }

  .meta-streak {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    color: var(--text-2);
  }

  .meta-streak :global(svg) {
    color: var(--warning);
    font-size: 14px;
  }

  .meta-notes {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: var(--text-2);
    font-size: inherit;
  }

  .desc {
    margin-top: 2px;
    font-size: var(--text-sm);
    color: var(--text-3);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .desc :global(p) {
    display: inline;
  }

  .desc :global(a) {
    color: var(--accent);
  }

  .control {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    cursor: default;
  }

  /* Binary: a round check that fills with the habit color. */
  .check {
    position: relative;
    width: 30px;
    height: 30px;
    margin: 7px;
    border-radius: 50%;
    border: 2px solid var(--separator-strong);
    display: grid;
    place-items: center;
    color: #fff;
    font-size: 19px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.1s var(--ease);
  }

  .check:active {
    transform: scale(0.9);
  }

  .check input {
    position: absolute;
    inset: -7px;
    opacity: 0;
    cursor: pointer;
  }

  .check.on {
    background: var(--habit);
    border-color: var(--habit);
  }

  .check.on.break {
    background: var(--danger);
    border-color: var(--danger);
  }

  /* Quantity stepper */
  .stepper {
    display: flex;
    align-items: center;
    height: 36px;
    border-radius: 999px;
    background: var(--surface-2);
  }

  .stepper button {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--text);
    font-size: 18px;
  }

  .stepper button:active:not(:disabled) {
    background: var(--surface-3);
  }

  .stepper button:disabled {
    color: var(--text-3);
  }

  .stepper-value {
    width: 2.6em;
    border: none;
    background: none;
    text-align: center;
    font-size: var(--text-md);
    font-weight: 600;
    color: var(--text);
    -moz-appearance: textfield;
    appearance: textfield;
    padding: 0;
  }

  .stepper-value::-webkit-outer-spin-button,
  .stepper-value::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .stepper-value:focus {
    outline: none;
  }

  .met { color: var(--habit) !important; }
  .target { color: var(--success) !important; }
  .over { color: var(--danger) !important; }

  /* Duration timer */
  .timer {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .dur-input-wrap {
    display: flex;
    align-items: baseline;
    padding: 0 var(--space-1);
    font-size: var(--text-md);
    font-weight: 600;
    color: var(--text);
  }

  .dur-input-wrap.running {
    color: var(--accent);
  }

  .dur-input {
    width: 1.35em;
    border: none;
    background: none;
    padding: 0;
    text-align: center;
    font: inherit;
    font-variant-numeric: tabular-nums;
    color: inherit;
  }

  .dur-input:disabled {
    opacity: 1;
    -webkit-text-fill-color: currentColor;
  }

  .dur-input:focus {
    outline: none;
    background: var(--accent-soft);
    border-radius: 4px;
  }

  .dur-sep {
    color: var(--text-3);
  }

  .round {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-size: 20px;
    transition: transform 0.1s var(--ease);
  }

  .round:active {
    transform: scale(0.9);
  }

  .round.primary {
    background: var(--habit);
    color: #fff;
  }

  .round.done {
    background: var(--success-soft);
    color: var(--success);
  }

  .round.subtle {
    color: var(--text-3);
    font-size: 18px;
  }
</style>
