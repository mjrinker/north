// src/routes/tags/+page.svelte
<script lang="ts">
  import type { Habit } from '../../types';
  import { habitsStore } from '../../stores/habits';

  let habits: Habit[] = [];
  habitsStore.subscribe(v => (habits = v));

  // Collect all unique tags
  $: tags = Array.from(new Set(habits.flatMap(h => h.tags)));

  let newTag = '';

  function addTag() {
    if (!newTag.trim()) return;
    // Add tag to all habits that don't have it
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
    <button on:click={addTag}>Add</button>
  </div>
</div>