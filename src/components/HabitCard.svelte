<script lang="ts">
  import type { Habit } from '../types';
  import { HabitEngine } from '../services/habitEngine';
  import { getEntry } from '../services/storage';
  import { habitsStore } from '../stores/habits';
  import { getLocalDateString } from '../lib/dates';
  import { timerStates, setTimerState, clearTimerState, defaultTimer, type TimerState, type AllTimers } from '../lib/timerStore';
  import { recordAutoCompletedDep } from '../lib/autoDeps';
  import { autoCompleteDependencies, uncheckDependencies } from '../lib/dependencyEngine';
  import { entriesStore } from '../stores/entries';
  import { onDestroy } from 'svelte';
  import Icon from '@iconify/svelte';
  let { habit, onEdit }: { habit: Habit; onEdit?: () => void } = $props();

  let allHabits = $state<Habit[]>([]);
  habitsStore.subscribe(v => allHabits = v);

  let streak = $state(0);
  let todayEntry = $state<{ value: number; standardMet: boolean; targetMet: boolean } | null>(null);
  let trigger = $state(0);
  entriesStore.subscribe(() => trigger++);
  let _gen = 0;
  let autoCompleted = $state(new Set<string>());
  let isAutoCompleted = $derived(habit.dependsOn ? autoCompleted.has(habit.id + '|' + getLocalDateString()) : false);
  let isStandardMet = $derived(todayEntry ? todayEntry.value >= habit.standard : false);
  let isTargetMet = $derived(todayEntry && habit.target != null ? todayEntry.value >= habit.target : false);
  $effect(() => {
    if (!habit) return;
    const _ = trigger;
    const gen = ++_gen;
    const today = getLocalDateString();
    const key = habit.id + '|' + today;
    (async () => {
      const entry = await getEntry(habit.id, today);
      if (_gen !== gen) return;
      todayEntry = entry ? { value: entry.value, standardMet: entry.standardMet, targetMet: entry.targetMet } : null;
      if (!todayEntry || todayEntry.value === 0) {
        autoCompleted.delete(key);
      }
      if (habit.type === 'binary' && habit.dependsOn) {
        const depResults = await Promise.all(
          habit.dependsOn!.habitIds.map(async hid => {
            const e = await getEntry(hid, today);
            const dep = allHabits.find(h => h.id === hid);
            return { hid, met: e && dep ? e.value >= dep.standard : false };
          })
        );
        if (_gen !== gen) return;
        const satisfied = habit.dependsOn!.mode === 'and'
          ? depResults.every(r => r.met)
          : depResults.some(r => r.met);
        const value = todayEntry?.value ?? 0;
        if (satisfied && value === 0) {
          for (const r of depResults) {
            if (!r.met) continue;
            const e = await getEntry(r.hid, today);
            if (e && e.value > 0) continue;
            recordAutoCompletedDep(habit.id, today, r.hid);
          }
          autoCompleted.add(key);
            await HabitEngine.logCompletion(habit, today, 1);
          todayEntry = { value: 1, standardMet: 1 >= habit.standard, targetMet: habit.target != null && 1 >= habit.target };
        } else if (!satisfied && value === 1) {
          await HabitEngine.logCompletion(habit, today, 0);
          autoCompleted.delete(key);
          todayEntry = { value: 0, standardMet: false, targetMet: false };
        }
        if (todayEntry?.value === 0) {
          autoCompleted.delete(key);
        }
      }
      if (_gen !== gen) return;
      streak = await HabitEngine.getStreak(habit);
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
  let manualMinutes = $state('');

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
    const newElapsed = s.pausedElapsed + Math.floor((Date.now() - s.startedAt) / 1000);
    setTimerState(habit.id, { ...s, elapsed: newElapsed });
  }

  function startTimer() {
    const mins = manualMinutes ? parseInt(manualMinutes) : (todayEntry?.value ?? 0);
    const initial = (isNaN(mins) ? 0 : mins) * 60;
    setTimerState(habit.id, { running: true, paused: false, elapsed: initial, pausedElapsed: initial, startedAt: Date.now() });
    startTimerInterval();
    manualMinutes = '';
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

  async function doneTimer() {
    const s = allTimerStates[habit.id];
    if (!s) return;
    clearTimerInterval();
    await logAndRefresh(s.elapsed / 60);
    clearTimerState(habit.id);
  }

  function cancelTimer() {
    clearTimerInterval();
    clearTimerState(habit.id);
  }

  async function handleDurationSet(hours: number, minutes: number, seconds: number) {
    if (!habit) return;
    await logAndRefresh(hours * 60 + minutes + seconds / 60);
  }

  let durTotalSec = $derived(Math.round((todayEntry?.value ?? 0) * 60));
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
    const today = getLocalDateString();
    await HabitEngine.logCompletion(habit, today, value);
    const entry = await getEntry(habit.id, today);
    todayEntry = entry ? { value: entry.value, standardMet: entry.standardMet, targetMet: entry.targetMet } : null;
  }

  function clearTimerInterval() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function startTimerInterval() {
    clearTimerInterval();
    timerInterval = setInterval(tick, 200);
  }

  async function handleBinaryChange() {
    if (!habit) return;
    const today = getLocalDateString();
    const wasChecked = todayEntry?.value === 1;
    const value = wasChecked ? 0 : 1;
    const getEntryFn = (hid: string, d: string) => getEntry(hid, d);
    if (value === 1 && habit.dependsOn) {
      await autoCompleteDependencies(habit, today, allHabits, getEntryFn);
    }
    if (wasChecked && habit.dependsOn) {
      await uncheckDependencies(habit, today, allHabits, getEntryFn);
    }
    await logAndRefresh(value);
  }

  async function handleQuantityDelta(delta: number) {
    if (!habit) return;
    const current = todayEntry?.value ?? 0;
    await logAndRefresh(Math.max(0, current + delta));
  }

  async function handleQuantitySet(value: number) {
    if (!habit) return;
    await logAndRefresh(value);
  }
</script>

<div class="habit-card" role="button" tabindex="0" onclick={() => onEdit?.()} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit?.(); } }}>
  <div class="card-left">
    <div class="title-row">
      <h3>{habit.title}</h3>
      {#if habit.dependsOn && habit.dependsOn.habitIds.length > 0}
        <span class="dep-badge">
          {#each habit.dependsOn.habitIds as hid, i}
            {#if i > 0} {habit.dependsOn!.mode} {/if}{allHabits.find(h => h.id === hid)?.title ?? hid}
          {/each}
        </span>
      {/if}
    </div>
    <p class="streak">Streak: {streak} {habit.schedule.daysPerWeek ? 'weeks' : 'days'}</p>
  </div>
  <div class="card-right">
    {#if habit.type === 'binary'}
      <div class="action-control">
        <label class="binary-input-wrap" class:checked={todayEntry?.value === 1} onclick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={todayEntry?.value === 1} onchange={handleBinaryChange} disabled={isAutoCompleted} />
          {#if todayEntry?.value === 1}
            <Icon icon="mdi:check" class="check-icon" />
          {/if}
        </label>
      </div>
    {:else if habit.type === 'quantity'}
      <div class="action-control">
        <button onclick={(e) => { e.stopPropagation(); handleQuantityDelta(-1); }} class="btn small">−</button>
        <div class="qty-input-wrap" onclick={(e) => e.stopPropagation()}>
          <input
            type="number"
            value={todayEntry?.value ?? 0}
            min="0"
            class="qty-input"
            class:standard-met={isStandardMet}
            class:target-met={isTargetMet}
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
      </div>
    {:else if habit.type === 'duration'}
      <div class="action-control">
        {#if timerState.running}
          {#if timerState.paused}
            <button onclick={(e) => { e.stopPropagation(); resumeTimer(); }} class="btn-icon play" aria-label="Resume"><Icon icon="mdi:play" /></button>
          {:else}
            <button onclick={(e) => { e.stopPropagation(); pauseTimer(); }} class="btn-icon pause" aria-label="Pause"><Icon icon="mdi:pause" /></button>
          {/if}
          <button onclick={(e) => { e.stopPropagation(); doneTimer(); }} class="btn-icon done" aria-label="Done"><Icon icon="mdi:check" /></button>
          <button onclick={(e) => { e.stopPropagation(); cancelTimer(); }} class="btn-icon cancel" aria-label="Cancel"><Icon icon="mdi:close" /></button>
        {:else}
          <button onclick={(e) => { e.stopPropagation(); startTimer(); }} class="btn-icon play" aria-label="Start"><Icon icon="mdi:play" /></button>
        {/if}
        {#if todayEntry && todayEntry.value > 0}
          <button onclick={(e) => { e.stopPropagation(); handleReset(); }} class="btn-icon restart" aria-label="Reset"><Icon icon="mdi:restart" /></button>
        {/if}
        <div class="dur-input-wrap" class:running={timerState.running} style:--sep-color={timerState.running ? '#888' : undefined} onclick={(e) => e.stopPropagation()}>
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

<style>
  .habit-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
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
  .dep-badge {
    font-size: 0.65rem;
    padding: 1px 6px;
    border-radius: 4px;
    white-space: nowrap;
    background: var(--card-bg, #f5f5f5);
    color: var(--text-secondary, #666);
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
  }
  .btn {
    border: none;
    border-radius: 4px;
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
    background: var(--accent, #0066cc);
    color: white;
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
  .btn-icon :global(svg), .btn-icon :global(.iconify) { font-size: 1.3rem; }
  .btn-icon.play { background: var(--accent, #0066cc); color: white; }
  .btn-icon.pause { background: #f59e0b; color: white; }
  .btn-icon.done { background: #2e7d32; color: white; }
  .btn-icon.cancel { background: transparent; color: var(--text-primary, #222); border: 1px solid var(--card-border, #ccc); }
  .btn-icon.restart { background: transparent; color: var(--text-primary, #222); border: 1px solid var(--card-border, #ccc); }
  .qty-input-wrap {
    display: flex;
    align-items: center;
    background: var(--input-bg, #f5f5f5);
    border-radius: 4px;
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
  .qty-input.standard-met { color: #2e7d32; }
  .qty-input.target-met {
    color: #2e7d32;
    animation: shimmer 1.2s ease-in-out;
  }
  .dur-input-wrap {
    display: flex;
    align-items: center;
    gap: 0;
    background: var(--input-bg, #f5f5f5);
    border-radius: 4px;
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
    border-radius: 4px;
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
  .check-icon {
    font-size: 2.2rem;
    color: var(--text-primary, #222);
    pointer-events: none;
  }

  @keyframes shimmer {
    0% { text-shadow: 0 0 0 transparent; }
    50% { text-shadow: 0 0 8px rgba(46, 125, 50, 0.6); }
    100% { text-shadow: 0 0 0 transparent; }
  }
</style>
