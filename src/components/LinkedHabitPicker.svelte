<script lang="ts">
  import type { Habit } from '../types';
  let { habits = [] as Habit[], linkedIds = $bindable([] as string[]), excludeId = '' } = $props();
  let visible = $derived(habits.filter(h => h.id !== excludeId && h.id));

  function toggle(id: string) {
    linkedIds = linkedIds.includes(id) ? linkedIds.filter(i => i !== id) : [...linkedIds, id];
  }
</script>

{#if visible.length > 0}
  <span class="field-label">Link with</span>
  <p class="hint">Logging on any linked habit logs the same value on all of them. Only habits of the same type can be linked.</p>
  <div class="link-picker">
    {#each visible as h (h.id)}
      <button type="button" class:selected={linkedIds.includes(h.id)} onclick={() => toggle(h.id)}>{h.title}</button>
    {/each}
  </div>
{/if}

<style>
  .field-label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
    color: var(--text-primary, #222);
  }
  .hint {
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
    margin: 0 0 0.4rem;
  }
  .link-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 0.75rem;
  }
  .link-picker button {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    background: var(--card-bg, #f5f5f5);
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
    font-family: inherit;
  }
  .link-picker button.selected {
    background: #0066cc;
    color: #fff;
    border-color: #0066cc;
  }
</style>
