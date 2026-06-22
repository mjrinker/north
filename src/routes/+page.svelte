<script lang="ts">
  import { habitsStore, addHabit } from '../stores/habits';
  import type { Habit, DependsOn } from '../types';
  import HabitCard from '../components/HabitCard.svelte';
  import { showModal } from '../stores/theme';

  let habits = $state<Habit[]>([]);
  let modalOpen = $state(false);
  showModal.subscribe(v => modalOpen = v);
  habitsStore.subscribe(v => habits = v);

  let newHabitTitle = $state('');
  let newHabitType = $state<Habit['type']>('binary');
  let newHabitStandard = $state('');
  let newHabitTarget = $state('');
  let newHabitFrequency = $state('daily');
  let newHabitInterval = $state('1');
  let newHabitDaysOfWeek = $state<number[]>([]);
  let newHabitDepIds = $state<string[]>([]);
  let newHabitDepMode = $state<'and' | 'or'>('and');

  let showStandard = $derived(newHabitType !== 'binary');

  let weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function toggleDay(d: number) {
    if (newHabitDaysOfWeek.includes(d)) {
      newHabitDaysOfWeek = newHabitDaysOfWeek.filter(i => i !== d);
    } else {
      newHabitDaysOfWeek = [...newHabitDaysOfWeek, d];
    }
  }

  function toggleDep(id: string) {
    if (newHabitDepIds.includes(id)) {
      newHabitDepIds = newHabitDepIds.filter(i => i !== id);
    } else {
      newHabitDepIds = [...newHabitDepIds, id];
    }
  }

  function handleAddHabit(e: SubmitEvent) {
    e.preventDefault();
    if (!newHabitTitle.trim()) return;

    const dependsOn: DependsOn | undefined = newHabitDepIds.length > 0
      ? { habitIds: newHabitDepIds, mode: newHabitDepMode }
      : undefined;

    const newHabit: Habit = {
      id: crypto.randomUUID(),
      title: newHabitTitle.trim(),
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
      dependsOn,
      identityId: undefined,
      tags: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    addHabit(newHabit);
    newHabitTitle = '';
    newHabitStandard = '';
    newHabitTarget = '';
    newHabitInterval = '1';
    newHabitDaysOfWeek = [];
    newHabitDepIds = [];
    newHabitDepMode = 'and';
    showModal.set(false);
  }
</script>

<h1 class="page-title">My Habits</h1>

<button class="add-habit-btn" onclick={() => showModal.set(true)}>+ Add Habit</button>

{#if modalOpen}
<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Add new habit" tabindex="-1" onkeydown={(e) => { if (e.key === 'Escape') showModal.set(false); }} onclick={() => showModal.set(false)}>
  <div class="modal" onclick={e => e.stopPropagation()}>
    <h2>Add New Habit</h2>
    <form onsubmit={handleAddHabit}>
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

        <label for="target">Goal</label>
        <input type="number" bind:value={newHabitTarget} placeholder="Goal (optional)" min="1" />
      {/if}

      <label for="frequency">Frequency</label>
      <select bind:value={newHabitFrequency}>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
        <option value="monthly">Monthly</option>
        <option value="custom">Every X Days</option>
      </select>

      <label for="interval">Every</label>
      <input type="number" bind:value={newHabitInterval} min="1" />

      {#if newHabitFrequency === 'weekly'}
        <label>Days of Week</label>
        <div class="day-picker">
          {#each weekDays as day, i}
            <button type="button" class:selected={newHabitDaysOfWeek.includes(i)} onclick={() => toggleDay(i)}>{day}</button>
          {/each}
        </div>
      {/if}

      {#if habits.length > 0}
        <label>Depends on</label>
        <div class="dep-mode">
          <button type="button" class:active={newHabitDepMode === 'and'} onclick={() => newHabitDepMode = 'and'}>AND</button>
          <button type="button" class:active={newHabitDepMode === 'or'} onclick={() => newHabitDepMode = 'or'}>OR</button>
        </div>
        <div class="dep-picker">
          {#each habits as h (h.id)}
            <button type="button" class:selected={newHabitDepIds.includes(h.id)} onclick={() => toggleDep(h.id)}>{h.title}</button>
          {/each}
        </div>
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
    color: var(--text-primary, #222);
  }
  .add-habit-btn {
    background: var(--accent, #0066cc);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 1.2rem;
    cursor: pointer;
    margin-bottom: 1rem;
  }
  .add-habit-btn:hover { opacity: 0.9; }
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
    background: var(--card-bg, #fff);
    border-radius: 8px;
    padding: 1.5rem;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  }
  .modal h2 {
    margin: 0 0 1rem;
    color: var(--text-primary, #222);
  }
  .modal label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
    color: var(--text-primary, #222);
  }
  .modal input, .modal select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    font-size: 1rem;
    box-sizing: border-box;
    margin-bottom: 0.75rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }

  .dep-mode {
    display: flex;
    gap: 4px;
    margin-bottom: 0.5rem;
  }
  .dep-mode button {
    flex: 1;
    padding: 0.3rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    background: var(--card-bg, #f5f5f5);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
  }
  .dep-mode button.active {
    background: var(--accent, #0066cc);
    color: white;
    border-color: var(--accent, #0066cc);
  }
  .dep-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 0.75rem;
  }
  .dep-picker button {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    background: var(--card-bg, #f5f5f5);
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
  }
  .dep-picker button.selected {
    background: var(--accent, #0066cc);
    color: white;
    border-color: var(--accent, #0066cc);
  }

  .day-picker {
    display: flex;
    gap: 4px;
    margin-bottom: 0.75rem;
  }
  .day-picker button {
    width: 2.5rem;
    height: 2.2rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    background: var(--card-bg, #f5f5f5);
    cursor: pointer;
    font-size: 0.75rem;
    color: var(--text-primary, #222);
  }
  .day-picker button.selected {
    background: var(--accent, #0066cc);
    color: white;
    border-color: var(--accent, #0066cc);
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
    cursor: pointer;
  }
  .modal-actions button[type="submit"] {
    background: var(--accent, #0066cc);
    color: white;
  }
  .modal-actions button[type="button"] {
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
  }

  @media (max-width: 600px) {
    .habits-grid { grid-template-columns: 1fr; }
  }
</style>