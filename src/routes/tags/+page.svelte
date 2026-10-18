<script lang="ts">
  import type { Habit } from '../../types';
  import { habitsStore } from '../../stores/habits';
  import Icon from '@iconify/svelte';

  let habits = $state<Habit[]>([]);
  habitsStore.subscribe(v => (habits = v));

  // Tags exist only on habits; add or remove them from a habit's edit sheet.
  let tags = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const h of habits) {
      if (h.status === 'deleted') continue;
      for (const t of h.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });
</script>

<div class="page">
  <a class="back" href="/settings"><Icon icon="mdi:chevron-left" />Settings</a>
  <h1 class="page-title">Tags</h1>

  {#if tags.length}
    <div class="group">
      {#each tags as [tag, count] (tag)}
        <div class="row">
          <span class="row-label">{tag}</span>
          <span class="row-value tabular">{count} habit{count === 1 ? '' : 's'}</span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="empty">No tags yet.</p>
  {/if}
  <p class="section-footnote">Add tags from a habit’s edit sheet. Today groups habits by tag.</p>
</div>

<style>
  .back {
    display: inline-flex;
    align-items: center;
    margin-left: -6px;
  }

  .back :global(svg) { font-size: 22px; }
</style>
