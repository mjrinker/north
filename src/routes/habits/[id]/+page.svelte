<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { habitsStore, removeHabit } from '../../../stores/habits';
  import type { Habit } from '../../../types';

  const habitId = $page.params.id;
  let habit = $state<Habit | undefined>(undefined);

  $effect(() => {
    const found = habitsStore.find(h => h.id === habitId);
    if (found) habit = found;
  });

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

  function updateHabit() {
    if (!habit) return;
    habit.title = title;
    habit.standard = standard;
    habit.target = target;
    habit.type = type;
    habit.updatedAt = new Date();
    habitsStore.update(list => list.map(h => h.id === habit!.id ? habit : h));
  }

  function deleteHabit() {
    if (!habit) return;
    removeHabit(habit.id);
    goto('/habits');
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

      <button onclick={updateHabit}>Save Changes</button>
      <button onclick={deleteHabit}>Delete Habit</button>
    </div>
  {:else}
    <p>Habit not found.</p>
  {/if}

  <button onclick={() => goto('/habits')}>Back to list</button>
</div>