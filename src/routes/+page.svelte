<script lang="ts">
  import { habitsStore } from '../stores/habits';
  import type { Habit } from '../types';
  import HabitCard from '../components/HabitCard.svelte';
  import { showModal } from '../stores/theme';
  
  let habits = $state<Habit[]>([]);
  let otherHabits = $derived(habits);
  habitsStore.subscribe(v => habits = v);
  
  let newHabitTitle = $state<string>('');
  let newHabitType = $state<Habit['type']>('binary');
  let newHabitStandard = $state<string>('');
  let newHabitTarget = $state<string>('');
  let newHabitFrequency = $state<string>('daily');
  let newHabitInterval = $state<string>('1');
  let newHabitDaysOfWeek = $state<number[]>([]);
  let newHabitPartial = $state(false);
  let newHabitDependsOn = $state<string>('');
  
  let showStandard = $derived(newHabitType !== 'binary');
  let showTarget = $derived(newHabitType !== 'binary');
  
  let weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  function toggleDay(d: number) {
    if (newHabitDaysOfWeek.includes(d)) {
      newHabitDaysOfWeek = newHabitDaysOfWeek.filter(i => i !== d);
    } else {
      newHabitDaysOfWeek = [...newHabitDaysOfWeek, d];
    }
  }
  
  async function handleAddHabit() {
    const newHabit: Habit = {
      id: crypto.randomUUID(),
      title: newHabitTitle,
      type: newHabitType,
      standard: newHabitStandard ? parseInt(newHabitStandard) : 1,
      target: (newHabitType !== 'binary' && newHabitTarget) ? parseInt(newHabitTarget) : undefined,
      unit: newHabitType === 'duration' ? 'minutes' : 'times',
      schedule: {
        frequency: newHabitFrequency as 'daily' | 'weekly' | 'monthly' | 'custom',
        interval: parseInt(newHabitInterval) || 1,
        daysOfWeek: newHabitFrequency === 'weekly' && newHabitDaysOfWeek.length > 0 ? newHabitDaysOfWeek : undefined,
        startDate: new Date()
      },
      metadata: {
        remindersEnabled: false,
        reminderAdvanceMinutes: 0,
        streakFreezeDays: 0,
        allowBackdating: true
      },
      partial: newHabitType !== 'binary' ? newHabitPartial : undefined,
      dependsOn: newHabitDependsOn || undefined,
      identityId: undefined,
      tags: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const { addHabit: add } = await import('../stores/habits');
    add(newHabit);
    newHabitTitle = '';
    newHabitStandard = '';
    newHabitTarget = '';
    newHabitInterval = '1';
    newHabitDaysOfWeek = [];
    newHabitPartial = false;
    newHabitDependsOn = '';
    showModal.set(false);
  }
</script>

<h1 class="page-title">My Habits</h1>

<button class="add-habit-btn" onclick={() => showModal.set(true)}>+ Add Habit</button>

{#if $showModal}
<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Add new habit" tabindex="-1" onkeydown={(e) => { if (e.key === 'Escape') showModal.set(false); }} onclick={() => showModal.set(false)}>
  <div class="modal" onclick={e => e.stopPropagation()}>
    <h2>Add New Habit</h2>
    <form onsubmit.prevent={handleAddHabit}>
      <label for="title">Title</label>
      <input type="text" bind:value={newHabitTitle} placeholder="Enter habit title" required />
      
      <label for="type">Type</label>
      <select bind:value={newHabitType} required>
        <option value="binary">Binary (Done / Not Done)</option>
        <option value="quantity">Quantity (Count)</option>
        <option value="duration">Duration (Time)</option>
      </select>
      
      {#if showStandard}
        <label for="standard">Standard</label>
        <input type="number" bind:value={newHabitStandard} placeholder="Standard value" min="1" />
      {/if}
      
      {#if showTarget}
        <label for="target">Goal</label>
        <input type="number" bind:value={newHabitTarget} placeholder="Goal (optional)" min="1" />
      {/if}
      
      {#if newHabitType !== 'binary'}
        <label class="checkbox-line">
          <input type="checkbox" bind:checked={newHabitPartial} />
          Partial progress (show as "5 / 30" instead of just "5")
        </label>
      {/if}
      
      <label for="frequency">Frequency</label>
      <select bind:value={newHabitFrequency}>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
        <option value="monthly">Monthly</option>
        <option value="custom">Every X Days</option>
      </select>
      
      <label for="interval">Interval</label>
      <input type="number" bind:value={newHabitInterval} placeholder="Every..." min="1" />
      
      {#if newHabitFrequency === 'weekly'}
        <label>Days of Week</label>
        <div class="day-picker">
          {#each weekDays as day, i}
            <button type="button" class:selected={newHabitDaysOfWeek.includes(i)} onclick={() => toggleDay(i)}>{day}</button>
          {/each}
        </div>
      {/if}
      
      {#if otherHabits.length > 0}
        <label for="dependsOn">Depends on (conditional)</label>
        <select bind:value={newHabitDependsOn}>
          <option value="">None</option>
          {#each otherHabits as h (h.id)}
            <option value={h.id}>{h.title}</option>
          {/each}
        </select>
      {/if}
      
      <div class="modal-actions">
        <button type="submit">Create</button>
        <button type="button" onclick={() => showModal.set(false)}>Cancel</button>
      </div>
    </form>
  </div>
</div>
{/if}

<div class="habits-grid">
  {#each habits as habit (habit.id)}
    <HabitCard habit={habit} />
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
    box-sizing: border-box;
    margin-bottom: 0.75rem;
  }
  
  .checkbox-line {
    display: flex !important;
    align-items: center;
    gap: 0.5rem;
    font-weight: 400;
    margin-bottom: 0.75rem;
  }
  .checkbox-line input {
    width: auto;
    margin-bottom: 0;
  }
  
  .day-picker {
    display: flex;
    gap: 4px;
    margin-bottom: 0.75rem;
  }
  .day-picker button {
    width: 2.5rem;
    height: 2.2rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #f5f5f5;
    cursor: pointer;
    font-size: 0.75rem;
  }
  .day-picker button.selected {
    background: #0066cc;
    color: white;
    border-color: #0066cc;
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
  
  @media (max-width: 600px) {
    .habits-grid {
      grid-template-columns: 1fr;
    }
  }
</style>