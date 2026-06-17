<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { habitsStore, removeHabit } from '../stores/habits';
  import type { Habit } from '../types';

  let habits: Habit[] = [];
  habitsStore.subscribe(v => (habits = v));

  $: habit = habits.find(h => h.id === page.params.id);
  $: title = habit?.title ?? '';
  $: standard = habit?.standard ?? 1;
  $: target = habit?.target ?? 1;
  $: type = habit?.type ?? 'binary';

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
  <h1>{habit?.title}</h1>

  {#if habit}
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <label>Title</label>
      <input bind:value={title} />

      <label>Type</label>
      <select bind:value={type}>
        <option value="binary">Binary (Checkmark)</option>
        <option value="quantity">Quantity (Count)</option>
        <option value="duration">Duration (Time)</option>
        <option value="partial">Partial (Percentage)</option>
        <option value="conditional">Conditional</option>
      </select>

      <label>Standard</label>
      <input type="number" bind:value={standard} />

      <label>Target</label>
      <input type="number" bind:value={target} />

      <button on:click={updateHabit}>Save Changes</button>
      <button on:click={deleteHabit}>Delete Habit</button>
    </div>
  {:else}
    <p>Habit not found.</p>
  {/if}

  <button on:click={() => goto('/habits')}>Back to list</button>
</div>
