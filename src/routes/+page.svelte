<script lang="ts">
  import { habitsStore } from '../stores/habits';
  import type { Habit } from '../types';
  import HabitCard from '../components/HabitCard.svelte';
  import { theme, showModal, type ThemeMode } from '../stores/theme';
  
  const { subscribe } = habitsStore;
  let habits = $state<Habit[]>([]);
  subscribe(v => habits = v);
  
  let currentTheme = $state<'light' | 'dark' | 'system'>('system');
  theme.subscribe(v => currentTheme = v);
  
  // Local state for new habit form
  let newHabitTitle = $state<string>('');
  let newHabitType = $state<"binary" | "quantity" | "duration">('binary');
  let newHabitStandard = $state<string>('');
  let newHabitTarget = $state<string>('');
  let newHabitFrequency = $state<string>('daily');
  let newHabitInterval = $state<string>('1');
  
  async function handleAddHabit() {
    const newHabit = {
      id: crypto.randomUUID(),
      title: newHabitTitle,
      type: newHabitType,
      standard: newHabitStandard ? parseInt(newHabitStandard) : 1,
      target: newHabitTarget ? parseInt(newHabitTarget) : undefined,
      schedule: {
        frequency: newHabitFrequency,
        interval: parseInt(newHabitInterval)
      }
    };
    await import('../stores/habits').then(mod => {
      const store = mod.habitsStore;
      store.addHabit(newHabit);
    });
    newHabitTitle = '';
    newHabitStandard = '';
    newHabitTarget = '';
    newHabitInterval = '';
    showModal.set(false);
  }
  
  async function refreshHabits() {
    const store = await import('../stores/habits');
    store.habitsStore.loadHabits();
  }
</script>

<h1 class="page-title">My Habits</h1>

<!-- Add habit button -->
<button class="add-habit-btn" onclick={() => showModal.set(true)}>+ Add Habit</button>

<!-- Modal for adding a new habit -->
{#if $showModal}
<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Add new habit" tabindex="-1" onkeydown={(e) => { if (e.key === 'Escape') showModal.set(false); }} onclick={() => showModal.set(false)}>
  <div class="modal">
    <h2>Add New Habit</h2>
    <form onsubmit.prevent={handleAddHabit}>
      <label for="title">Title</label>
      <input type="text" bind:value={newHabitTitle} placeholder="Enter habit title" required />
      
      <label for="type">Type</label>
      <select bind:value={newHabitType} required>
        <option value="binary">Binary</option>
        <option value="quantity">Quantity</option>
        <option value="duration">Duration</option>
      </select>
      
      <label for="standard">Standard</label>
      <input type="number" bind:value={newHabitStandard} placeholder="Standard (e.g., 1)" min="1" />
      
      <label for="target">Target</label>
      <input type="number" bind:value={newHabitTarget} placeholder="Target (optional)" min="1" />
      
      <label for="frequency">Frequency</label>
      <select bind:value={newHabitFrequency}>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
      
      <label for="interval">Interval</label>
      <input type="number" bind:value={newHabitInterval} placeholder="Interval (e.g., 1)" min="1" />
      
      <div class="modal-actions">
        <button type="submit">Create</button>
        <button type="button" onclick={() => showModal.set(false)}>Cancel</button>
      </div>
    </form>
  </div>
</div>
{/if}

<!-- Habit grid -->
<div class="habits-grid">
  {#each habits as habit (habit.id)}
    <HabitCard 
      habit={habit} 
      theme={currentTheme} 
      theme-toggle={toggleTheme} 
      on:habitadded={refreshHabits}
    />
  {/each}
</div>



<style>
  .page-title {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: #222;
  }
  
   .add-habit-btn {
    background: #0066cc;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 1.2rem;
    cursor: pointer;
    margin-bottom: 1rem;
  }
  
  .add-habit-btn:hover {
    background: #0052a3;
  }
  
  .habits-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  }
  
  .modal h2 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #222;
  }
  
  .modal label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
  }
  
  .modal input, .modal select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
  }
  
  .modal-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  
  .modal-actions button {
    flex: 1;
    padding: 0.5rem;
    border-radius: 4px;
    border: none;
    font-weight: 500;
  }
  
  .modal-actions button[type="submit"] {
    background: #0066cc;
    color: white;
  }
  
  .modal-actions button[type="button"] {
    background: #eee;
    color: #222;
  }
  
  /* Responsive adjustments */
  @media (max-width: 600px) {
    
    .habits-grid {
      grid-template-columns: 1fr;
    }
  }
</style>