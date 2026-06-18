<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { habitsStore, removeHabit } from '../../../stores/habits';
  import type { Habit } from '../../../types';

  const habitId = $page.params.id;
  let title = $derived(habitsStore.find(h => h.id === habitId)?.title ?? '');
  let standard = $derived(habitsStore.find(h => h.id === habitId)?.standard ?? 1);
  let target = $derived(habitsStore.find(h => h.id === habitId)?.target ?? 1);
  let type = $derived(habitsStore.find(h => h.id === habitId)?.type ?? 'binary');

  function updateHabit() { /* placeholder: update local entry */ }
  function deleteHabit() { /* placeholder: delete from storage */ }
</script>

<div style="padding: 1rem; max-width: 500px; margin: 0 auto;">
  <h1>{title}</h1>

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

  <button onclick={() => goto('/habits')}>Back to list</button>
</div>