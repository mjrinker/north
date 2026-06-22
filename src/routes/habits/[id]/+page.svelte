<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { habitsStore, updateHabit, removeHabit } from '../../../stores/habits';
  import type { Habit, DependsOn } from '../../../types';

  const habitId = $page.params.id;
  let allHabits = $state<Habit[]>([]);
  habitsStore.subscribe(v => (allHabits = v));

  let habit = $derived(allHabits.find(h => h.id === habitId));

  let title = $state('');
  let standard = $state(1);
  let target = $state<number | undefined>(undefined);
  let type = $state<Habit['type']>('binary');
  let depIds = $state<string[]>([]);
  let depMode = $state<'and' | 'or'>('and');
  let frequency = $state('daily');
  let interval = $state(1);

  $effect(() => {
    if (habit) {
      title = habit.title;
      standard = habit.standard;
      target = habit.target;
      type = habit.type;
      depIds = habit.dependsOn?.habitIds ?? [];
      depMode = habit.dependsOn?.mode ?? 'and';
      frequency = habit.schedule.frequency;
      interval = habit.schedule.interval;
    }
  });

  function toggleDep(id: string) {
    if (depIds.includes(id)) {
      depIds = depIds.filter(i => i !== id);
    } else {
      depIds = [...depIds, id];
    }
  }

  function handleSave() {
    if (!habit) return;
    const dependsOn: DependsOn | undefined = depIds.length > 0 ? { habitIds: depIds, mode: depMode } : undefined;
    const updated: Habit = {
      ...habit,
      title,
      standard,
      target: type !== 'binary' ? target : undefined,
      type,
      dependsOn,
      schedule: { ...habit.schedule, frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'custom', interval }
    };
    updateHabit(updated);
    goto('/habits');
  }

  function handleDelete() {
    if (!habit) return;
    if (confirm('Delete this habit?')) {
      removeHabit(habit.id);
      goto('/habits');
    }
  }
</script>

<div class="page">
  <h1>{habit?.title ?? 'Loading...'}</h1>

  {#if habit}
    <div class="form-grid">
      <label>Title <input bind:value={title} /></label>

      <label>Type
        <select bind:value={type}>
          <option value="binary">Binary (Done / Not Done)</option>
          <option value="quantity">Quantity (Count)</option>
          <option value="duration">Duration (Time)</option>
        </select>
      </label>

      {#if type !== 'binary'}
        <label>Standard <input type="number" bind:value={standard} /></label>
        <label>Goal <input type="number" bind:value={target} /></label>
      {/if}

      <label>Frequency
        <select bind:value={frequency}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Every X Days</option>
        </select>
      </label>

      <label>Interval <input type="number" bind:value={interval} min="1" /></label>

      {#if allHabits.filter(h => h.id !== habit.id).length > 0}
        <label>Depends on mode
          <div class="dep-mode">
            <button type="button" class:active={depMode === 'and'} onclick={() => depMode = 'and'}>AND</button>
            <button type="button" class:active={depMode === 'or'} onclick={() => depMode = 'or'}>OR</button>
          </div>
        </label>
        <label>Depends on
          <div class="dep-picker">
            {#each allHabits.filter(h => h.id !== habit.id) as h (h.id)}
              <button type="button" class:selected={depIds.includes(h.id)} onclick={() => toggleDep(h.id)}>{h.title}</button>
            {/each}
          </div>
        </label>
      {/if}

      <div class="actions">
        <button onclick={handleSave}>Save Changes</button>
        <button class="danger" onclick={handleDelete}>Delete</button>
      </div>
    </div>
  {:else}
    <p class="not-found">Habit not found.</p>
  {/if}

  <button class="back" onclick={() => goto('/habits')}>← Back to list</button>
</div>

<style>
  .page { padding: 1rem; max-width: 500px; margin: 0 auto; }
  h1 { color: var(--text-primary, #222); }
  .form-grid { display: flex; flex-direction: column; gap: 1rem; }
  label {
    font-weight: 500;
    color: var(--text-primary, #222);
  }
  input, select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    font-size: 1rem;
    box-sizing: border-box;
    margin-top: 0.25rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
  .dep-mode { display: flex; gap: 4px; margin-top: 4px; }
  .dep-mode button {
    flex: 1;
    padding: 0.3rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    background: var(--btn-secondary-bg, #f5f5f5);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
  }
  .dep-mode button.active { background: var(--accent, #0066cc); color: white; border-color: var(--accent, #0066cc); }
  .dep-picker { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .dep-picker button {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    background: var(--btn-secondary-bg, #f5f5f5);
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
  }
  .dep-picker button.selected { background: var(--accent, #0066cc); color: white; border-color: var(--accent, #0066cc); }
  .actions { display: flex; gap: 0.5rem; }
  .actions button {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
  }
  .actions button:first-child { background: var(--accent, #0066cc); color: white; }
  .actions button.danger { background: #d32f2f; color: white; }
  .back {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
    cursor: pointer;
  }
  .not-found { color: var(--text-secondary, #888); }
</style>
