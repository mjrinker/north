<script lang="ts">
  import type { Habit, DependsOn } from '../types';
  import { HabitEngine } from '../services/habitEngine';
  import { getEntry } from '../services/storage';
  import { habitsStore } from '../stores/habits';
  let { habit }: { habit: Habit } = $props();

  let allHabits = $state<Habit[]>([]);
  habitsStore.subscribe(v => allHabits = v);

  let streak = $state(0);
  let todayEntry = $state<{ value: number; standardMet: boolean; targetMet: boolean } | null>(null);

  let depEntries = $state<{ habitId: string; value: number; standard: number }[]>([]);

  $effect(() => {
    if (!habit) return;
    const engine = new HabitEngine(habit);
    (async () => {
      streak = await engine.getStreak();
      const today = new Date().toISOString().split('T')[0];
      const entry = await getEntry(habit.id, today);
      todayEntry = entry ? { value: entry.value, standardMet: entry.standardMet, targetMet: entry.targetMet } : null;
      if (habit.dependsOn) {
        const results = await Promise.all(
          habit.dependsOn.habitIds.map(async (hid) => {
            const h = allHabits.find(x => x.id === hid);
            if (!h) return null;
            const e = await getEntry(hid, today);
            return { habitId: hid, value: e?.value ?? 0, standard: h.standard };
          })
        );
        depEntries = results.filter(Boolean) as { habitId: string; value: number; standard: number }[];
      }
    })();
  });

  let depMet = $derived(() => {
    if (!habit.dependsOn || depEntries.length === 0) return true;
    if (habit.dependsOn.mode === 'and') return depEntries.every(e => e.value >= e.standard);
    return depEntries.some(e => e.value >= e.standard);
  });

  let isStandardMet = $derived(todayEntry ? todayEntry.value >= habit.standard : false);
  let isTargetMet = $derived(todayEntry && habit.target != null ? todayEntry.value >= habit.target : false);

  // Timer state
  let timerRunning = $state(false);
  let timerPaused = $state(false);
  let timerAccumulated = $state(0);
  let timerSessionStart = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let manualMinutes = $state('');

  function updateTimer() {
    timerAccumulated = timerAccumulated + Math.floor((Date.now() - timerSessionStart) / 1000);
  }

  function startTimer() {
    timerRunning = true;
    timerPaused = false;
    timerSessionStart = Date.now();
    timerInterval = setInterval(() => {
      timerAccumulated = timerAccumulated + Math.floor((Date.now() - timerSessionStart) / 1000);
    }, 200);
  }

  function pauseTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    updateTimer();
    timerPaused = true;
  }

  function resumeTimer() {
    timerPaused = false;
    timerSessionStart = Date.now();
    timerInterval = setInterval(() => {
      timerAccumulated = timerAccumulated + Math.floor((Date.now() - timerSessionStart) / 1000);
    }, 200);
  }

  async function doneTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    updateTimer();
    timerRunning = false;
    timerPaused = false;
    const engine = new HabitEngine(habit);
    const today = new Date().toISOString().split('T')[0];
    const minutes = Math.max(0.1, timerAccumulated / 60);
    await engine.logCompletion(today, minutes);
    const entry = await getEntry(habit.id, today);
    todayEntry = entry ? { value: entry.value, standardMet: entry.standardMet, targetMet: entry.targetMet } : null;
    timerAccumulated = 0;
  }

  function cancelTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    timerPaused = false;
    timerAccumulated = 0;
  }

  async function handleManualDuration() {
    if (!manualMinutes) return;
    const val = parseInt(manualMinutes);
    if (isNaN(val) || val < 1) return;
    const engine = new HabitEngine(habit);
    const today = new Date().toISOString().split('T')[0];
    await engine.logCompletion(today, val);
    const entry = await getEntry(habit.id, today);
    todayEntry = entry ? { value: entry.value, standardMet: entry.standardMet, targetMet: entry.targetMet } : null;
    manualMinutes = '';
  }

  async function handleReset() {
    const engine = new HabitEngine(habit);
    const today = new Date().toISOString().split('T')[0];
    await engine.logCompletion(today, 0);
    todayEntry = null;
  }

  function formatDuration(totalSec: number): string {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatLoggedMinutes(minutes: number): string {
    const totalSec = Math.round(minutes * 60);
    return formatDuration(totalSec);
  }

  async function handleBinaryChange() {
    if (!habit) return;
    const engine = new HabitEngine(habit);
    const today = new Date().toISOString().split('T')[0];
    const value = todayEntry?.value === 1 ? 0 : 1;
    await engine.logCompletion(today, value);
    const entry = await getEntry(habit.id, today);
    todayEntry = entry ? { value: entry.value, standardMet: entry.standardMet, targetMet: entry.targetMet } : null;
  }

  async function handleQuantityDelta(delta: number) {
    if (!habit) return;
    const engine = new HabitEngine(habit);
    const today = new Date().toISOString().split('T')[0];
    const current = todayEntry?.value ?? 0;
    const newValue = Math.max(0, current + delta);
    await engine.logCompletion(today, newValue);
    const entry = await getEntry(habit.id, today);
    todayEntry = entry ? { value: entry.value, standardMet: entry.standardMet, targetMet: entry.targetMet } : null;
  }
</script>

<div class="habit-card">
  <div class="card-left">
    <div class="title-row">
      <h3>{habit.title}</h3>
      {#if habit.dependsOn && habit.dependsOn.habitIds.length > 0}
        <span class="dep-badge" class:dep-met={depMet()} class:dep-unmet={!depMet()}>
          {#each habit.dependsOn.habitIds as hid, i}
            {#if i > 0} {habit.dependsOn!.mode} {/if}{allHabits.find(h => h.id === hid)?.title ?? hid}
          {/each}
        </span>
      {/if}
    </div>
    <p class="streak">Streak: {streak} days</p>
  </div>
  <div class="card-right">
    {#if habit.type === 'binary'}
      <div class="action-control">
        <label class="checkbox-label">
          <input type="checkbox" checked={todayEntry?.value === 1} onchange={handleBinaryChange} />
        </label>
        <span class="action-label">Done</span>
      </div>
    {:else if habit.type === 'quantity'}
      <div class="action-control">
        <button onclick={() => handleQuantityDelta(-1)} class="btn small">−</button>
        <span
          class="quantity-value"
          class:standard-met={isStandardMet}
          class:target-met={isTargetMet}
        >{todayEntry?.value ?? 0}</span>
        <button onclick={() => handleQuantityDelta(1)} class="btn small">+</button>
      </div>
    {:else if habit.type === 'duration'}
      <div class="action-control">
        {#if timerRunning}
          <span class="timer-display">{formatDuration(timerAccumulated)}</span>
          {#if timerPaused}
            <button onclick={resumeTimer} class="btn start">Resume</button>
            <button onclick={doneTimer} class="btn stop">Done</button>
            <button onclick={cancelTimer} class="btn cancel">X</button>
          {:else}
            <button onclick={pauseTimer} class="btn stop">Pause</button>
            <button onclick={cancelTimer} class="btn cancel">X</button>
          {/if}
        {:else}
          <button onclick={startTimer} class="btn start">Start</button>
          <div class="manual-entry">
            <input type="number" bind:value={manualMinutes} placeholder="min" min="1" class="min-input" />
            <button onclick={handleManualDuration} class="btn small">+</button>
          </div>
          {#if todayEntry && todayEntry.value > 0}
            <span
              class="logged-value"
              class:standard-met={isStandardMet}
              class:target-met={isTargetMet}
            >{formatLoggedMinutes(todayEntry.value)}</span>
            <button onclick={handleReset} class="btn reset">Reset</button>
          {/if}
        {/if}
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
  }
  .dep-badge.dep-met { background: #e8f5e9; color: #2e7d32; }
  .dep-badge.dep-unmet { background: #fce4ec; color: #c62828; }
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
  }
  .btn.small {
    width: 1.8rem;
    height: 1.8rem;
    font-size: 0.9rem;
    background: var(--accent, #0066cc);
    color: white;
  }
  .btn.start {
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    background: var(--accent, #0066cc);
    color: white;
  }
  .btn.stop {
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    background: #d32f2f;
    color: white;
  }
  .btn.cancel {
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
    background: #666;
    color: white;
  }
  .btn.reset {
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
    background: transparent;
    color: var(--text-secondary, #666);
    border: 1px solid var(--card-border, #ccc);
  }
  .btn:hover { opacity: 0.85; }
  .quantity-value {
    min-width: 1.8rem;
    text-align: center;
    font-weight: bold;
    font-size: 0.9rem;
    color: var(--text-primary, #222);
    transition: color 0.3s;
  }
  .quantity-value.standard-met { color: #2e7d32; }
  .quantity-value.target-met {
    color: #2e7d32;
    animation: shimmer 1.2s ease-in-out;
  }
  .timer-display {
    font-variant-numeric: tabular-nums;
    font-weight: bold;
    font-size: 0.9rem;
    color: var(--text-primary, #222);
    min-width: 4rem;
    text-align: center;
  }
  .manual-entry {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .min-input {
    width: 3rem;
    padding: 0.25rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    font-size: 0.75rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
    text-align: center;
  }
  .logged-value {
    font-size: 0.8rem;
    font-weight: 600;
    margin-left: 0.25rem;
    transition: color 0.3s;
  }
  .logged-value.standard-met { color: #2e7d32; }
  .logged-value.target-met {
    color: #2e7d32;
    animation: shimmer 1.2s ease-in-out;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .checkbox-label input {
    width: 1.1rem;
    height: 1.1rem;
    appearance: none;
    border: 2px solid var(--card-border, #ccc);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
    background: var(--input-bg, #fff);
    transition: background 0.2s;
  }
  .checkbox-label input:checked {
    background: var(--accent, #0066cc);
    border-color: var(--accent, #0066cc);
  }

  @keyframes shimmer {
    0% { text-shadow: 0 0 0 transparent; }
    50% { text-shadow: 0 0 8px rgba(46, 125, 50, 0.6); }
    100% { text-shadow: 0 0 0 transparent; }
  }
</style>
