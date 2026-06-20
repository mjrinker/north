<script lang="ts">
  import type { Habit } from '../types';
  import { HabitEngine } from '../services/habitEngine';
  import { getEntry, saveEntry } from '../services/storage';
  let { habit } = $props();

  let streak = $state(0);
  let todayEntry = $state<{ value: number } | null>(null);
  let isLogging = $state(false);
  // Re‑run when habit updates
  $effect(() => {
    const engine = new HabitEngine(habit);
    if (!habit) return;
    (async () => {
      streak = await engine.getStreak();
      const today = new Date().toISOString().split('T')[0];
      const entry = await getEntry(habit.id, today);
      todayEntry = entry ? { value: entry.value } : null;
    })();
  });

  async function handleBinaryChange() {
    if (!habit) return;
    const engine = new HabitEngine(habit);
    const today = new Date().toISOString().split('T')[0];
    const value = todayEntry?.value === 1 ? 0 : 1; // toggle
    await engine.logCompletion(today, value);
    // Update todayEntry
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

  async function handleDurationStart() {
    if (!habit) return;
    const engine = new HabitEngine(habit);
    const today = new Date().toISOString().split('T')[0];
    const value = habit.target ?? habit.standard ?? 5; // default 5 minutes
    await engine.logCompletion(today, value);
    todayEntry = { value };
  }
</script>

<div class="habit-card" class:dark={false}>
  <div class="card-content">
    <h3>{habit.title}</h3>
    <p class="streak">Streak: {streak} days</p>
    {#if habit.type === 'binary'}
      <div class="action-control">
        <label class="checkbox-label">
          <input type="checkbox" checked={todayEntry?.value === 1} on:change={handleBinaryChange} />
          <span class="checkbox-slider"></span>
        </label>
        <span class="action-label">Done</span>
      </div>
    {:else if habit.type === 'quantity'}
      <div class="action-control">
        <button on:click={() => handleQuantityDelta(-1)} class="quantity-btn">−</button>
        <span class="quantity-value">{todayEntry?.value ?? 0}</span>
        <button on:click={() => handleQuantityDelta(1)} class="quantity-btn">+</button>
        <span class="action-label">Reps</span>
      </div>
    {:else if habit.type === 'duration'}
      <div class="action-control">
        <button on:click={handleDurationStart} class="duration-btn">
          {#if isLogging}
            Logging...
          {:else}
            Start
          {/if}
        </button>
        <span class="action-label">Min</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .habit-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    margin: 0.5rem 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  
  .card-content {
    flex: 1;
    min-width: 0;
  }
  
  .habit-card h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    color: var(--text-primary);
  }
  
  .streak {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .action-control {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }
  
  .checkbox-label input {
    width: 1.2rem;
    height: 1.2rem;
    appearance: none;
    border: 2px solid var(--border-color);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
    position: relative;
    background: var(--checkbox-bg);
    transition: background 0.2s;
  }
  
  .checkbox-label input:checked {
    background: var(--accent-color);
    border-color: var(--accent-color);
  }
  
  .checkbox-label input:checked::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 4px;
    height: 8px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }
  
  .checkbox-slider {
    width: 1.2rem;
    height: 1.2rem;
    background: var(--checkbox-bg);
    border: 2px solid var(--border-color);
    border-radius: 3px;
    display: inline-block;
  }
  
  .action-label {
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }
  
  .quantity-btn {
    width: 2.2rem;
    height: 2.2rem;
    border: none;
    background: var(--accent-color);
    color: white;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
  }
  
  .quantity-btn:hover {
    opacity: 0.9;
  }
  
  .quantity-value {
    min-width: 2.2rem;
    text-align: center;
    font-weight: bold;
    color: var(--text-primary);
  }
  
  .duration-btn {
    padding: 0.5rem 1rem;
    border: none;
    background: var(--accent-color);
    color: white;
    border-radius: 4px;
    font-size: 0.9rem;
    cursor: pointer;
  }
  
  .duration-btn:hover {
    opacity: 0.9;
  }
  
  :global(.dark) .habit-card {
    --card-bg: #2d2d2d;
    --border-color: #444;
    --text-primary: #fff;
    --text-secondary: #bbb;
    --text-tertiary: #888;
    --accent-color: #0066cc;
    --checkbox-bg: #444;
  }
  
  :global(.light) .habit-card {
    --card-bg: #fff;
    --border-color: #ddd;
    --text-primary: #222;
    --text-secondary: #555;
    --text-tertiary: #777;
    --accent-color: #0066cc;
    --checkbox-bg: #f0f0f0;
  }
  
  :global(.system) .habit-card {
    @media (prefers-color-scheme: dark) {
      --card-bg: #2d2d2d;
      --border-color: #444;
      --text-primary: #fff;
      --text-secondary: #bbb;
      --text-tertiary: #888;
      --accent-color: #0066cc;
      --checkbox-bg: #444;
    }
    @media (prefers-color-scheme: light) {
      --card-bg: #fff;
      --border-color: #ddd;
      --text-primary: #222;
      --text-secondary: #555;
      --text-tertiary: #777;
      --accent-color: #0066cc;
      --checkbox-bg: #f0f0f0;
    }
  }
</style>