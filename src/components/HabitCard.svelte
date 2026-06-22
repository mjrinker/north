<script lang="ts">
  import type { Habit } from '../types';
  import { HabitEngine } from '../services/habitEngine';
  import { getEntry } from '../services/storage';
  import { habitsStore } from '../stores/habits';
  let { habit }: { habit: Habit } = $props();

  let allHabits = $state<Habit[]>([]);
  habitsStore.subscribe(v => allHabits = v);

  let streak = $state(0);
  let todayEntry = $state<{ value: number } | null>(null);

  let depHabit = $derived(habit.dependsOn ? allHabits.find(h => h.id === habit.dependsOn) : null);
  let depEntry = $state<{ value: number } | null>(null);

  $effect(() => {
    if (!habit) return;
    const engine = new HabitEngine(habit);
    (async () => {
      streak = await engine.getStreak();
      const today = new Date().toISOString().split('T')[0];
      const entry = await getEntry(habit.id, today);
      todayEntry = entry ? { value: entry.value } : null;
      if (habit.dependsOn) {
        const de = await getEntry(habit.dependsOn, today);
        depEntry = de ? { value: de.value } : null;
      }
    })();
  });

  // Timer state for duration habits
  let timerRunning = $state(false);
  let timerStartTime = $state(0);
  let timerElapsed = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  function startTimer() {
    timerRunning = true;
    timerStartTime = Date.now();
    timerElapsed = 0;
    timerInterval = setInterval(() => {
      timerElapsed = Math.floor((Date.now() - timerStartTime) / 1000);
    }, 200);
  }

  async function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    const engine = new HabitEngine(habit);
    const today = new Date().toISOString().split('T')[0];
    const minutes = Math.max(1, Math.round(timerElapsed / 60));
    await engine.logCompletion(today, minutes);
    todayEntry = { value: minutes };
    timerElapsed = 0;
  }

  function formatTimer(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function formatPartial(value: number): string {
    const target = habit.target ?? habit.standard;
    return `${value} / ${target}`;
  }

  async function handleBinaryChange() {
    if (!habit) return;
    const engine = new HabitEngine(habit);
    const today = new Date().toISOString().split('T')[0];
    const value = todayEntry?.value === 1 ? 0 : 1;
    await engine.logCompletion(today, value);
    todayEntry = { value };
  }

  async function handleQuantityDelta(delta: number) {
    if (!habit) return;
    const engine = new HabitEngine(habit);
    const today = new Date().toISOString().split('T')[0];
    const current = todayEntry?.value ?? 0;
    const newValue = Math.max(0, current + delta);
    await engine.logCompletion(today, newValue);
    todayEntry = { value: newValue };
  }

  let depMet = $derived(depEntry ? depEntry.value >= (depHabit?.standard ?? 1) : true);
</script>

<div class="habit-card">
  <div class="card-left">
    <div class="title-row">
      <h3>{habit.title}</h3>
      {#if depHabit}
        <span class="dep-badge" title="Depends on: {depHabit.title}">⬅ {depHabit.title}</span>
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
      <div class="action-control row">
        <button onclick={() => handleQuantityDelta(-1)} class="btn small">−</button>
        <span class="quantity-value">{habit.partial && todayEntry ? formatPartial(todayEntry.value) : (todayEntry?.value ?? 0)}</span>
        <button onclick={() => handleQuantityDelta(1)} class="btn small">+</button>
        <span class="action-label">{habit.partial ? '' : 'Reps'}</span>
      </div>
    {:else if habit.type === 'duration'}
      <div class="action-control">
        {#if timerRunning}
          <span class="timer-display">{formatTimer(timerElapsed)}</span>
          <button onclick={stopTimer} class="btn stop">Stop</button>
        {:else}
          <button onclick={startTimer} class="btn start">Start</button>
          {#if todayEntry}
            <span class="logged-value">{habit.partial ? formatPartial(todayEntry.value) : todayEntry.value + ' min'}</span>
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
  .card-left {
    flex: 1;
    min-width: 0;
  }
  .card-right {
    flex-shrink: 0;
  }
  .title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .title-row h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text);
  }
  .dep-badge {
    font-size: 0.65rem;
    background: var(--accent-light, #e0f0ff);
    color: var(--accent, #0066cc);
    padding: 1px 6px;
    border-radius: 4px;
    white-space: nowrap;
  }
  .streak {
    margin: 2px 0 0 0;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  .action-control {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .action-control.row {
    flex-direction: row;
  }
  .action-label {
    font-size: 0.7rem;
    color: var(--text-secondary);
  }
  .btn {
    border: none;
    background: var(--accent);
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
  }
  .btn.small {
    width: 1.8rem;
    height: 1.8rem;
    font-size: 0.9rem;
  }
  .btn.start {
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
  }
  .btn.stop {
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    background: #d32f2f;
  }
  .btn:hover { opacity: 0.9; }
  .quantity-value {
    min-width: 1.8rem;
    text-align: center;
    font-weight: bold;
    font-size: 0.9rem;
    color: var(--text);
  }
  .timer-display {
    font-variant-numeric: tabular-nums;
    font-weight: bold;
    font-size: 0.9rem;
    color: var(--text);
    min-width: 3.5rem;
    text-align: center;
  }
  .logged-value {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-left: 0.25rem;
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
    background: var(--input-bg);
    transition: background 0.2s;
  }
  .checkbox-label input:checked {
    background: var(--accent);
    border-color: var(--accent);
  }
</style>
