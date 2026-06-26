<script lang="ts">
  import type { Habit } from '../types';
  import { HabitEngine } from '../services/habitEngine';
  import { getEntry } from '../services/storage';
  import { habitsStore } from '../stores/habits';
  import { getLocalDateString } from '../lib/dates';
  let { habit, onEdit }: { habit: Habit; onEdit?: () => void } = $props();

  let allHabits = $state<Habit[]>([]);
  habitsStore.subscribe(v => allHabits = v);

  let streak = $state(0);
  let todayEntry = $state<{ value: number; standardMet: boolean; targetMet: boolean } | null>(null);
  $effect(() => {
    if (!habit) return;
    const engine = new HabitEngine(habit);
    (async () => {
      streak = await engine.getStreak();
      const today = getLocalDateString();
      const entry = await getEntry(habit.id, today);
      todayEntry = entry ? { value: entry.value, standardMet: entry.standardMet, targetMet: entry.targetMet } : null;
    })();
  });

  let isStandardMet = $derived(todayEntry ? todayEntry.value >= habit.standard : false);
  let isTargetMet = $derived(todayEntry && habit.target != null ? todayEntry.value >= habit.target : false);

  // Timer state
  let timerRunning = $state(false);
  let timerPaused = $state(false);
  let timerElapsed = $state(0);
  let timerPausedElapsed = $state(0);
  let timerStartedAt = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let manualMinutes = $state('');

  function tick() {
    timerElapsed = timerPausedElapsed + Math.floor((Date.now() - timerStartedAt) / 1000);
  }

  function startTimer() {
    timerRunning = true;
    timerPaused = false;
    const mins = manualMinutes ? parseInt(manualMinutes) : todayEntry?.value;
    const initial = (isNaN(mins) ? 0 : mins) * 60;
    timerElapsed = initial;
    timerPausedElapsed = initial;
    timerStartedAt = Date.now();
    timerInterval = setInterval(tick, 200);
    manualMinutes = '';
  }

  function pauseTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerPausedElapsed = timerElapsed;
    timerStartedAt = 0;
    timerPaused = true;
  }

  function resumeTimer() {
    timerPaused = false;
    timerStartedAt = Date.now();
    timerInterval = setInterval(tick, 200);
  }

  async function doneTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    const total = timerElapsed;
    timerRunning = false;
    timerPaused = false;
    const engine = new HabitEngine(habit);
    const today = getLocalDateString();
    const minutes = Math.max(0.1, total / 60);
    await engine.logCompletion(today, minutes);
    const entry = await getEntry(habit.id, today);
    todayEntry = entry ? { value: entry.value, standardMet: entry.standardMet, targetMet: entry.targetMet } : null;
    timerElapsed = 0;
    timerPausedElapsed = 0;
    timerStartedAt = 0;
  }

  function cancelTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    timerPaused = false;
    timerElapsed = 0;
    timerPausedElapsed = 0;
    timerStartedAt = 0;
  }

  async function handleManualDuration() {
    if (!manualMinutes) return;
    const val = parseInt(manualMinutes);
    if (isNaN(val) || val < 1) return;
    const engine = new HabitEngine(habit);
    const today = getLocalDateString();
    await engine.logCompletion(today, val);
    const entry = await getEntry(habit.id, today);
    todayEntry = entry ? { value: entry.value, standardMet: entry.standardMet, targetMet: entry.targetMet } : null;
    manualMinutes = '';
  }

  async function handleReset() {
    const engine = new HabitEngine(habit);
    const today = getLocalDateString();
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

  async function cascadeUncheck(habitId: string, today: string) {
    const dependents = allHabits.filter(h => h.type === 'binary' && h.dependsOn?.habitIds.includes(habitId));
    for (const dep of dependents) {
      const depEntry = await getEntry(dep.id, today);
      if (!depEntry || depEntry.value === 0) continue;
      const otherDeps = dep.dependsOn!.habitIds.filter(id => id !== habitId);
      if (otherDeps.length === 0) {
        await new HabitEngine(dep).logCompletion(today, 0);
        continue;
      }
      const results = await Promise.all(otherDeps.map(async id => {
        const e = await getEntry(id, today);
        const h = allHabits.find(x => x.id === id);
        return (e?.value ?? 0) >= (h?.standard ?? 1);
      }));
      const otherMet = dep.dependsOn!.mode === 'and' ? results.every(Boolean) : results.some(Boolean);
      if (!otherMet) {
        await new HabitEngine(dep).logCompletion(today, 0);
      }
    }
  }

  async function autoCompleteDeps(habit: Habit, today: string) {
    for (const hid of habit.dependsOn!.habitIds) {
      const entry = await getEntry(hid, today);
      if (entry?.value && entry.value > 0) continue;
      const dep = allHabits.find(h => h.id === hid);
      if (!dep) continue;
      await new HabitEngine(dep).logCompletion(today, dep.standard);
    }
  }

  async function handleBinaryChange() {
    if (!habit) return;
    const today = getLocalDateString();
    const wasChecked = todayEntry?.value === 1;
    const value = wasChecked ? 0 : 1;
    const engine = new HabitEngine(habit);
    await engine.logCompletion(today, value);
    if (value === 1 && habit.dependsOn) {
      await autoCompleteDeps(habit, today);
    }
    if (wasChecked) {
      await cascadeUncheck(habit.id, today);
    }
    const entry = await getEntry(habit.id, today);
    todayEntry = entry ? { value: entry.value, standardMet: entry.standardMet, targetMet: entry.targetMet } : null;
  }

  async function handleQuantityDelta(delta: number) {
    if (!habit) return;
    const engine = new HabitEngine(habit);
    const today = getLocalDateString();
    const current = todayEntry?.value ?? 0;
    const newValue = Math.max(0, current + delta);
    await engine.logCompletion(today, newValue);
    const entry = await getEntry(habit.id, today);
    todayEntry = entry ? { value: entry.value, standardMet: entry.standardMet, targetMet: entry.targetMet } : null;
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
    <p class="streak">Streak: {streak} days</p>
  </div>
  <div class="card-right">
    {#if habit.type === 'binary'}
      <div class="action-control">
        <label class="checkbox-label" onclick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={todayEntry?.value === 1} onchange={handleBinaryChange} />
        </label>
        <span class="action-label">Done</span>
      </div>
    {:else if habit.type === 'quantity'}
      <div class="action-control">
        <button onclick={(e) => { e.stopPropagation(); handleQuantityDelta(-1); }} class="btn small">−</button>
        <span
          class="quantity-value"
          class:standard-met={isStandardMet}
          class:target-met={isTargetMet}
        >{todayEntry?.value ?? 0}</span>
        <button onclick={(e) => { e.stopPropagation(); handleQuantityDelta(1); }} class="btn small">+</button>
      </div>
    {:else if habit.type === 'duration'}
      <div class="action-control">
        {#if timerRunning}
          <span class="timer-display">{formatDuration(timerElapsed)}</span>
          {#if timerPaused}
            <button onclick={(e) => { e.stopPropagation(); resumeTimer(); }} class="btn start">Resume</button>
            <button onclick={(e) => { e.stopPropagation(); doneTimer(); }} class="btn stop">Done</button>
            <button onclick={(e) => { e.stopPropagation(); cancelTimer(); }} class="btn cancel">X</button>
          {:else}
            <button onclick={(e) => { e.stopPropagation(); pauseTimer(); }} class="btn stop">Pause</button>
            <button onclick={(e) => { e.stopPropagation(); cancelTimer(); }} class="btn cancel">X</button>
          {/if}
        {:else}
          <button onclick={(e) => { e.stopPropagation(); startTimer(); }} class="btn start">Start</button>
          <div class="manual-entry" onclick={(e) => e.stopPropagation()}>
            <input type="number" bind:value={manualMinutes} placeholder="min" min="1" class="min-input" />
            <button onclick={(e) => { e.stopPropagation(); handleManualDuration(); }} class="btn small">+</button>
          </div>
          {#if todayEntry && todayEntry.value > 0}
            <span
              class="logged-value"
              class:standard-met={isStandardMet}
              class:target-met={isTargetMet}
            >{formatLoggedMinutes(todayEntry.value)}</span>
            <button onclick={(e) => { e.stopPropagation(); handleReset(); }} class="btn reset">Reset</button>
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
