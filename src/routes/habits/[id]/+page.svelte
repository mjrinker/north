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

  $effect(() => {
    if (habit) {
      title = habit.title;
      standard = habit.standard;
      target = habit.target;
      type = habit.type;
    }
  });

  function handleSave() {
    if (!habit) return;
    const updated = { ...habit, title, standard, target, type };
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
          <option value="binary">Binary (Checkmark)</option>
          <option value="quantity">Quantity (Count)</option>
          <option value="duration">Duration (Time)</option>
          <option value="partial">Partial (Percentage)</option>
          <option value="conditional">Conditional</option>
        </select>
      </label>

      <label>Standard <input type="number" bind:value={standard} /></label>

      <label>Target <input type="number" bind:value={target} /></label>

      <button onclick={handleSave}>Save Changes</button>
      <button onclick={handleDelete}>Delete Habit</button>
    </div>
  {:else}
    <p>Habit not found.</p>
  {/if}

  <button onclick={() => goto('/habits')}>Back to list</button>
</div>
