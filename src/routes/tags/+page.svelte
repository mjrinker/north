<script lang="ts">
  import type { Habit } from '../../types';
  import { habitsStore } from '../../stores/habits';
  import { saveHabit } from '../../services/storage';

  let habits = $state<Habit[]>([]);
  habitsStore.subscribe(v => (habits = v));

  let tags = $derived(Array.from(new Set(habits.flatMap(h => h.tags))));
  let newTag = $state('');

  async function addTag() {
    if (!newTag.trim()) return;
    const updated = habits.map(h => ({
      ...h,
      tags: [...new Set([...h.tags, newTag.trim()])]
    }));
    habitsStore.set(updated);
    // Persist each updated habit
    for (const h of updated) {
      await saveHabit(h).catch(console.error);
    }
    newTag = '';
  }
</script>

<div style="padding: 1rem;">
  <h1>Tags</h1>
  <ul>
    {#each tags as tag (tag)}
      <li>{tag}</li>
    {/each}
  </ul>

  <div style="margin-top: 1rem;">
    <input type="text" bind:value={newTag} placeholder="New tag" />
    <button onclick={addTag}>Add</button>
  </div>
</div>
