<script lang="ts">
  import type { Habit } from '../types';
  import { HabitEngine } from '../services/habitEngine';
  import { getEntry } from '../services/storage';
  import { habitsStore } from '../stores/habits';
  import { getLocalDateString } from '../lib/dates';
  import { isStandardMet as metStandard, isTargetMet as metTarget } from '../lib/thresholds';
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

  // Deterministic pseudo-random twinkle timing per sparkle so the glitter
  // looks organic but stays stable across renders.
  function sparkleTime(i: number): { delay: number; dur: number } {
    const frac = (seed: number) => {
      const v = Math.abs(Math.sin(i * seed + 78.233) % 1) * 43758.5453;
      return v - Math.floor(v);
    };
    return { delay: frac(12.9898) * 2, dur: 0.55 + frac(39.3467) * 1.6 };
  }
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

<div class="habit-card" class:first={isFirst} class:last={isLast} role="button" tabindex="0"
  style="--habit-color: {habit.metadata?.color || 'transparent'}; --habit-ink: {habit.metadata?.color || 'var(--text-primary)'};"
  use:useLongPressStart
  onclick={() => { if (!longPressFired) onEdit?.(); }}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit?.(); } }}>
  <div class="card-top">
    <div class="card-left">
      <div class="title-row">
        {#if habit.metadata?.emoji}
          <span class="habit-glyph">{habit.metadata.emoji}</span>
        {:else if habit.metadata?.icon}
          <span class="habit-glyph"><Icon icon={habit.metadata.icon} style="color: inherit" /></span>
        {/if}
        <h3>{habit.title}</h3>
        {#if habit.metadata?.category}
          <span class="category-badge" class:build={habit.metadata.category === 'build'}>{habit.metadata.category === 'build' ? 'Build' : 'Break'}</span>
        {/if}
        {#if habit.dependsOn && habit.dependsOn.habitIds.length > 0}
          <div class="dep-wrap">
            <button class="dep-badge" onclick={openDepPopover} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDepPopover(e); }}}>
              <span class="dep-badge-label">conditional</span>
              <span class="dep-badge-sep">|</span>
              <span class="dep-badge-count">✓ {depResults.filter(r => r.met).length}/{depResults.length}</span>
            </button>
          </div>
        {/if}
      </div>
      <p class="streak">Streak: {streak} {habit.schedule.daysPerWeek ? 'weeks' : 'days'}</p>
      {#if notesCount && notesCount > 0}
        <button class="note-pill" use:useNoteClick aria-label="Notes">
          <Icon icon="mdi:note-text-outline" style="color: inherit; font-size: 0.8rem;" />
          <span>{notesCount}</span>
        </button>
      {/if}
    </div>
    <div class="card-right">
      {#if habit.type === 'binary'}
      <div class="action-control">
        <label class="binary-input-wrap" class:checked={todayEntry?.value === 1} onclick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={todayEntry?.value === 1} onchange={handleBinaryChange} disabled={isAutoCompleted} onmousedown={(e) => e.preventDefault()} />
          {#if todayEntry?.value === 1}
            {#if isBreakHabit}
              <Icon icon="mdi:close" class="check-icon break" />
            {:else}
              <Icon icon="mdi:check" class="check-icon" />
            {/if}
          {/if}
        </label>
      </div>
    {:else if habit.type === 'quantity'}
      <div class="action-control">
        <button onclick={(e) => { e.stopPropagation(); handleQuantityDelta(-1); }} class="btn small">−</button>
        <div class="qty-input-wrap" class:target-met={isTargetMet} onclick={(e) => e.stopPropagation()}>
          {#each [0,1,2,3,4,5,6,7,8,9,10,11,12,13] as i (i)}
            <span class="sparkle" style:--tw-delay={`${sparkleTime(i).delay}s`} style:--tw-dur={`${sparkleTime(i).dur}s`}></span>
          {/each}
          <input
            type="number"
            value={todayEntry?.value ?? 0}
            min="0"
            class="qty-input"
            class:standard-met={isStandardMet}
            onfocus={(e) => {
              const target = e.currentTarget as HTMLInputElement;
              const len = target.value.length;
              target.setSelectionRange(len, len);
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                const target = e.currentTarget as HTMLInputElement;
                const val = parseInt(target.value);
                if (!isNaN(val) && val >= 0) {
                  handleQuantitySet(val);
                }
                target.blur();
              }
            }}
            onblur={(e) => {
              const target = e.currentTarget as HTMLInputElement;
              const val = parseInt(target.value);
              if (!isNaN(val) && val >= 0) {
                handleQuantitySet(val);
              }
            }}
          />
        </div>
        <button onclick={(e) => { e.stopPropagation(); handleQuantityDelta(1); }} class="btn small">+</button>
        {#if habit.unit}
          <span class="qty-unit">{unitLabel}</span>
        {/if}
      </div>
    {:else if habit.type === 'duration'}
      <div class="action-control">
        {#if timerState.running}
          {#if timerState.paused}
            <button onclick={(e) => { e.stopPropagation(); resumeTimer(); }} class="btn-icon play" aria-label="Resume"><Icon icon="mdi:play" style="color: inherit" /></button>
          {:else}
            <button onclick={(e) => { e.stopPropagation(); pauseTimer(); }} class="btn-icon pause" aria-label="Pause"><Icon icon="mdi:pause" style="color: inherit" /></button>
          {/if}
          <button onclick={(e) => { e.stopPropagation(); doneTimer(); }} class="btn-icon done" aria-label="Done"><Icon icon="mdi:check" style="color: inherit" /></button>
          <button onclick={(e) => { e.stopPropagation(); cancelTimer(); }} class="btn-icon cancel" aria-label="Cancel"><Icon icon="mdi:close" style="color: inherit" /></button>
        {:else}
          <button onclick={(e) => { e.stopPropagation(); startTimer(); }} class="btn-icon play" aria-label="Start"><Icon icon="mdi:play" style="color: inherit" /></button>
        {/if}
        {#if todayEntry && todayEntry.value > 0 && !timerState.running}
          <button onclick={(e) => { e.stopPropagation(); handleReset(); }} class="btn-icon restart" aria-label="Reset"><Icon icon="mdi:restart" style="color: inherit" /></button>
        {/if}
        <div class="dur-input-wrap" class:running={timerState.running} class:standard-met={isStandardMet} class:target-met={isTargetMet} style:--sep-color={timerState.running ? '#888' : undefined} onclick={(e) => e.stopPropagation()}>
          {#each [0,1,2,3,4,5,6,7,8,9,10,11,12,13] as i (i)}
            <span class="sparkle" style:--tw-delay={`${sparkleTime(i).delay}s`} style:--tw-dur={`${sparkleTime(i).dur}s`}></span>
          {/each}
          {#if (timerState.running ? timerHrs : durHours) > 0}
            <input
              type="text"
              inputmode="numeric"
              value={timerState.running ? timerHrs : durHours}
              class="dur-input"
              disabled={timerState.running}
              onfocus={(e) => { (e.currentTarget as HTMLInputElement).setSelectionRange(99, 99); }}
              onkeydown={(e) => { if (e.key === 'Enter') saveDurInputs(e); }}
              onblur={saveDurInputs}
            />
            <span class="dur-sep">:</span>
          {/if}
          <input
            type="text"
            inputmode="numeric"
            value={String(timerState.running ? timerMins : durMinutes).padStart(2, '0')}
            class="dur-input"
            disabled={timerState.running}
            onfocus={(e) => { (e.currentTarget as HTMLInputElement).setSelectionRange(99, 99); }}
            onkeydown={(e) => { if (e.key === 'Enter') saveDurInputs(e); }}
            onblur={saveDurInputs}
          />
          <span class="dur-sep">:</span>
          <input
            type="text"
            inputmode="numeric"
            value={String(timerState.running ? timerSecs : durSeconds).padStart(2, '0')}
            class="dur-input"
            disabled={timerState.running}
            onfocus={(e) => { (e.currentTarget as HTMLInputElement).setSelectionRange(99, 99); }}
            onkeydown={(e) => { if (e.key === 'Enter') saveDurInputs(e); }}
            onblur={saveDurInputs}
          />
        </div>
      </div>
    {/if}
  </div>
</div>
{#if habit.description}
  <div class="desc">{@html marked.parse(habit.description)}</div>
{/if}
</div>

<style>
.habit-card {
    position: relative;
    background: var(--card-bg);
    border: 1px solid var(--bg);
    border-left: 4px solid var(--habit-color, transparent);
    border-top-color: var(--bg);
    border-bottom-color: var(--bg);
    padding: 1.25rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0;
    flex: 1;
    min-width: 0;
  }
  .habit-card.first {
    border-top-color: var(--card-border, #e0e0e0);
  }
  .habit-card.last {
    border-bottom-color: var(--card-border, #e0e0e0);
  }
  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .card-left { flex: 1; min-width: 0; }
  .card-right { flex-shrink: 0; }
  .title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .title-row h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary, #222);
  }
  .habit-glyph {
    display: inline-flex;
    align-items: center;
    font-size: 1.15rem;
    line-height: 1;
    color: var(--habit-ink, var(--text-primary, #222));
  }
  .habit-glyph :global(svg), .habit-glyph :global(.iconify) { font-size: 1.15rem; color: inherit; }
  .category-badge {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 1px 7px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .category-badge.build { background: rgba(46, 125, 50, 0.14); color: #2e7d32; }
  .category-badge.break { background: rgba(230, 81, 0, 0.14); color: #e65100; }
  .desc {
    font-size: 0.8rem;
    color: var(--text-secondary, #666);
    line-height: 1.5;
    max-height: 6.75em;
    overflow-y: auto;
    margin-top: 0.35rem;
    word-wrap: break-word;
  }
  .desc :global(p) { margin: 0 0 0.4em; }
  .desc :global(p:last-child) { margin-bottom: 0; }
  .desc :global(ul), .desc :global(ol) { margin: 0.3em 0; padding-left: 1.2em; }
  .desc :global(li) { margin: 0.1em 0; }
  .desc :global(code) { font-size: 0.75em; background: var(--btn-secondary-bg, #eee); padding: 1px 4px; border-radius: 3px; }
  .desc :global(pre) { font-size: 0.75em; background: var(--btn-secondary-bg, #eee); padding: 0.5rem; border-radius: 4px; overflow-x: auto; margin: 0.4em 0; }
  .desc :global(blockquote) { margin: 0.4em 0; padding-left: 0.6em; border-left: 3px solid var(--card-border, #ccc); color: var(--text-secondary, #888); }
  .desc :global(a) { color: var(--text-secondary, #666); text-decoration: underline; }
  .desc :global(img) { max-width: 100%; height: auto; border-radius: 4px; }
  .dep-wrap {
    position: relative;
    display: inline-flex;
  }
  .dep-badge {
    font-size: 0.65rem;
    padding: 2px 10px;
    border-radius: 999px;
    white-space: nowrap;
    background: var(--accent, #0066cc);
    color: var(--accent-text, #fff);
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.4;
    border: none;
    cursor: pointer;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .dep-badge-label { white-space: nowrap; }
  .dep-badge-sep { opacity: 0.5; }
  .dep-badge-count {
    display: inline-flex;
    align-items: center;
    gap: 0.1rem;
    white-space: nowrap;
  }
  .dep-badge:hover {
    opacity: 0.85;
  }
  .streak {
    margin: 2px 0 0 0;
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
  }
  .action-control {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    position: relative;
  }
  .btn {
    border: none;
    border-radius: 0;
    cursor: pointer;
    font-weight: 600;
    height: 2.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }
  .btn.small {
    width: 2.4rem;
    font-size: 0.9rem;
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
  }
  .btn:hover { opacity: 0.85; }
  .btn-icon {
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 50%;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-sizing: border-box;
    flex-shrink: 0;
  }
  .btn-icon:hover { opacity: 0.85; }
  .btn-icon :global(svg), .btn-icon :global(.iconify) { font-size: 1.3rem; color: inherit; }
  .btn-icon.play { background: var(--btn-secondary-bg, #eee); color: var(--text-primary, #222); }
  .btn-icon.pause { background: #f59e0b; color: white; }
  .btn-icon.done { background: #2e7d32; color: white; }
  .btn-icon.cancel { background: transparent; color: var(--text-primary, #333); border: 1px solid var(--card-border, #ccc); }
  .note-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-secondary, #888);
    background: transparent;
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 999px;
    padding: 1px 8px 1px 4px;
    cursor: pointer;
    margin-top: 0.25rem;
    line-height: 1.4;
  }
  .note-pill:hover {
    color: var(--accent, #0066cc);
    border-color: var(--accent, #0066cc);
  }
  .btn-icon.restart { background: transparent; color: var(--text-primary, #333); border: 1px solid var(--card-border, #ccc); }
  .qty-input-wrap {
    display: flex;
    align-items: center;
    background: var(--input-bg, #f5f5f5);
    border-radius: 0;
    padding: 0 0.4rem;
    height: 2.4rem;
    box-sizing: border-box;
  }
  .qty-input {
    width: 3rem;
    padding: 0;
    border: none;
    font-size: 0.9rem;
    font-weight: bold;
    text-align: center;
    background: transparent;
    color: var(--text-primary, #222);
    outline: none;
    -moz-appearance: textfield;
    height: 2.4rem;
    box-sizing: border-box;
  }
  .qty-input::-webkit-outer-spin-button,
  .qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .qty-num-wrap { display: none; }
  .qty-unit {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.6rem;
    line-height: 1;
    color: var(--text-secondary, #888);
    max-width: 4rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
    margin-top: 1px;
  }
  .qty-input.standard-met { color: #2e7d32; }
  .qty-input-wrap.target-met,
  .dur-input-wrap.target-met:not(.running) {
    position: relative;
    overflow: hidden;
    background: linear-gradient(145deg, #c9a227 0%, #f5d778 28%, #e8c64a 52%, #f7e18c 74%, #c9a227 100%);
  }
  .qty-input-wrap.target-met .qty-input,
  .dur-input-wrap.target-met:not(.running) .dur-input {
    position: relative;
    z-index: 1;
    color: #000;
    -webkit-text-fill-color: #000;
  }
  .sparkle {
    position: absolute;
    z-index: 0;
    width: 1px;
    height: 1px;
    border-radius: 50%;
    background: radial-gradient(circle, #fff 0%, rgba(255, 255, 255, 0.9) 45%, rgba(255, 255, 255, 0) 72%);
    opacity: 0;
    pointer-events: none;
    filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9));
  }
  .sparkle:nth-of-type(3n) {
    width: 2px;
    height: 2px;
  }
  .qty-input-wrap.target-met .sparkle,
  .dur-input-wrap.target-met:not(.running) .sparkle {
    animation: twinkle var(--tw-dur, 1.8s) ease-in-out infinite;
    animation-delay: var(--tw-delay, 0s);
  }
  .qty-input-wrap .sparkle:nth-child(1),
  .dur-input-wrap .sparkle:nth-child(1) { top: 12%; left: 6%; }
  .qty-input-wrap .sparkle:nth-child(2),
  .dur-input-wrap .sparkle:nth-child(2) { top: 74%; left: 16%; }
  .qty-input-wrap .sparkle:nth-child(3),
  .dur-input-wrap .sparkle:nth-child(3) { top: 30%; left: 26%; }
  .qty-input-wrap .sparkle:nth-child(4),
  .dur-input-wrap .sparkle:nth-child(4) { top: 82%; left: 34%; }
  .qty-input-wrap .sparkle:nth-child(5),
  .dur-input-wrap .sparkle:nth-child(5) { top: 18%; left: 44%; }
  .qty-input-wrap .sparkle:nth-child(6),
  .dur-input-wrap .sparkle:nth-child(6) { top: 64%; left: 52%; }
  .qty-input-wrap .sparkle:nth-child(7),
  .dur-input-wrap .sparkle:nth-child(7) { top: 34%; left: 62%; }
  .qty-input-wrap .sparkle:nth-child(8),
  .dur-input-wrap .sparkle:nth-child(8) { top: 80%; left: 70%; }
  .qty-input-wrap .sparkle:nth-child(9),
  .dur-input-wrap .sparkle:nth-child(9) { top: 22%; left: 80%; }
  .qty-input-wrap .sparkle:nth-child(10),
  .dur-input-wrap .sparkle:nth-child(10) { top: 66%; left: 88%; }
  .qty-input-wrap .sparkle:nth-child(11),
  .dur-input-wrap .sparkle:nth-child(11) { top: 44%; left: 12%; }
  .qty-input-wrap .sparkle:nth-child(12),
  .dur-input-wrap .sparkle:nth-child(12) { top: 26%; left: 36%; }
  .qty-input-wrap .sparkle:nth-child(13),
  .dur-input-wrap .sparkle:nth-child(13) { top: 56%; left: 94%; }
  .qty-input-wrap .sparkle:nth-child(14),
  .dur-input-wrap .sparkle:nth-child(14) { top: 50%; left: 76%; }
  .dur-input-wrap {
    display: flex;
    align-items: center;
    gap: 0;
    background: var(--input-bg, #f5f5f5);
    border-radius: 0;
    padding: 0 0.4rem;
    height: 2.4rem;
    box-sizing: border-box;
  }
  .dur-input {
    width: 1.2rem;
    padding: 0;
    border: none;
    font-size: 0.9rem;
    font-weight: bold;
    text-align: right;
    background: transparent;
    color: var(--text-primary, #222);
    outline: none;
    -moz-appearance: textfield;
    height: 2.4rem;
    box-sizing: border-box;
  }
  .dur-input:disabled { color: #888; -webkit-text-fill-color: #888; opacity: 1; }
  .dur-input:last-child { text-align: left; }
  .dur-input-wrap.running { border: 1px solid var(--card-border, #ccc); padding: 0 0.4rem; background: transparent; }
  .dur-input-wrap.running .dur-input:disabled { background: transparent; }
  .dur-input-wrap.standard-met:not(.running) .dur-input { color: #2e7d32; }
  .dur-input-wrap.standard-met:not(.running) .dur-input::placeholder { color: #2e7d32; }
  .dur-input-wrap.standard-met:not(.running) .dur-sep { color: #2e7d32; }
  .dur-input-wrap.target-met:not(.running) .dur-sep { color: #000; }


  .dur-input::-webkit-outer-spin-button,
  .dur-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .dur-sep {
    font-size: 0.9rem;
    font-weight: bold;
    color: var(--sep-color, var(--text-primary, #222));
    line-height: 1;
    pointer-events: none;
  }
  .binary-input-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--input-bg, #f5f5f5);
    border-radius: 0;
    height: 2.4rem;
    width: 2.4rem;
    box-sizing: border-box;
    cursor: pointer;
    position: relative;
  }
  .binary-input-wrap input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }
  :global(.check-icon) {
    font-size: 2.2rem;
    color: #2e7d32;
    pointer-events: none;
  }
  :global(.check-icon.break) {
    color: #d32f2f;
  }

  @keyframes twinkle {
    0%, 100% { opacity: 0; transform: scale(0.5); }
    50% { opacity: 1; transform: scale(1.2); }
  }
</style>
