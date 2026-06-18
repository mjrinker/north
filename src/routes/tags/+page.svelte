<script lang="ts">
  import type { Habit } from '../../types';
  import { habitsStore } from '../../stores/habits';

  let habits = $state<Habit[]>([]);
  habitsStore.subscribe(v => (habits = v));

  let tags = $derived(Array.from(new Set(habits.flatMap(h => h.tags))));
  let newTag = $state('');

  function addTag() {
    if (!newTag.trim()) return;
    habitsStore.update(list =>
      list.map(h => ({
        ...h,
        tags: [...new Set([...h.tags, newTag.trim()])]
      }))
    );
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