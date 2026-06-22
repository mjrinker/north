<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { habitsStore, updateHabit, removeHabit } from '../../../stores/habits';
  import type { Habit } from '../../../types';

  const habitId = $page.params.id;
  let habits = $state<Habit[]>([]);
  habitsStore.subscribe(v => (habits = v));

  let habit = $derived(habits.find(h => h.id === habitId));

  let title = $state('');
  let standard = $state(1);
  let target = $state<number | undefined>(undefined);
  let type = $state<Habit['type']>('binary');
  let partial = $state(false);
  let dependsOn = $state('');
  let frequency = $state('daily');
  let interval = $state(1);

  $effect(() => {
    if (habit) {
      title = habit.title;
      standard = habit.standard;
      target = habit.target;
      type = habit.type;
      partial = habit.partial ?? false;
      dependsOn = habit.dependsOn ?? '';
      frequency = habit.schedule.frequency;
      interval = habit.schedule.interval;
    }
  });

  function handleSave() {
    if (!habit) return;
    const updated: Habit = { ...habit, title, standard, target: type !== 'binary' ? target : undefined, type, partial: type !== 'binary' ? partial : undefined, dependsOn: dependsOn || undefined, schedule: { ...habit.schedule, frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'custom', interval } };
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

<div style="padding: 1rem; max-width: 500px; margin: 0 auto;">
  <h1>{habit?.title ?? 'Loading...'}</h1>

  {#if habit}
    <div style="display: flex; flex-direction: column; gap: 1rem;">
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
        <label style="display: flex; align-items: center; gap: 0.5rem;">
          <input type="checkbox" bind:checked={partial} />
          Partial progress
        </label>
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

      {#if habits.length > 1}
        <label>Depends on
          <select bind:value={dependsOn}>
            <option value="">None</option>
            {#each habits.filter(h => h.id !== habit.id) as h (h.id)}
              <option value={h.id}>{h.title}</option>
            {/each}
          </select>
        </label>
      {/if}

      <button onclick={handleSave}>Save Changes</button>
      <button onclick={handleDelete}>Delete Habit</button>
    </div>
  {:else}
    <p>Habit not found.</p>
  {/if}

  <button onclick={() => goto('/habits')}>Back to list</button>
</div>
