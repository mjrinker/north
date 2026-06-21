<script lang="ts">
  import type { Habit } from '../types';
  import { HabitEngine } from '../services/habitEngine';
  import { getEntry } from '../services/storage';
  let { habit } = $props();

  let streak = $state(0);
  let todayEntry = $state<{ value: number } | null>(null);
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

  async function handleDurationStart() {
    if (!habit) return;
    const engine = new HabitEngine(habit);
    const today = new Date().toISOString().split('T')[0];
    const value = habit.target ?? habit.standard ?? 5;
    await engine.logCompletion(today, value);
    todayEntry = { value };
  }
</script>

<div class="habit-card">
  <div class="card-content">
    <h3>{habit.title}</h3>
    <p class="streak">Streak: {streak} days</p>
    {#if habit.type === 'binary'}
      <div class="action-control">
        <label class="checkbox-label">
          <input type="checkbox" checked={todayEntry?.value === 1} onchange={handleBinaryChange} />
          <span class="checkbox-slider"></span>
        </label>
        <span class="action-label">Done</span>
      </div>
    {:else if habit.type === 'quantity'}
      <div class="action-control">
        <button onclick={() => handleQuantityDelta(-1)} class="quantity-btn">−</button>
        <span class="quantity-value">{todayEntry?.value ?? 0}</span>
        <button onclick={() => handleQuantityDelta(1)} class="quantity-btn">+</button>
        <span class="action-label">Reps</span>
      </div>
    {:else if habit.type === 'duration'}
      <div class="action-control">
        <button onclick={handleDurationStart} class="duration-btn">Start</button>
        <span class="action-label">Min</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .habit-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 8px;
    padding: 1rem;
    margin: 0.5rem 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  
  .card-content { flex: 1; min-width: 0; }
  
  .habit-card h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.1rem;
    color: var(--text);
  }
  
  .streak {
    margin: 0 0 0.5rem 0;
    font-size: 0.85rem;
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
  
  .checkbox-slider { display: none; }
  
  .action-label {
    font-size: 0.7rem;
    color: var(--text-secondary);
  }
  
  .quantity-btn, .duration-btn {
    width: 2.2rem;
    height: 2.2rem;
    border: none;
    background: var(--accent);
    color: white;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
  }
  
  .quantity-btn:hover, .duration-btn:hover { opacity: 0.9; }
  
  .quantity-value {
    min-width: 2.2rem;
    text-align: center;
    font-weight: bold;
    color: var(--text);
  }
  
  .duration-btn { width: auto; padding: 0.5rem 1rem; }
</style>
