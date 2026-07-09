<script lang="ts">
  import type { Habit } from '../types';
  let { habits = [] as Habit[], depIds = $bindable([] as string[]), depMode = $bindable('and' as 'and' | 'or'), excludeId = '' } = $props();
  let visible = $derived(habits.filter(h => h.id !== excludeId && h.id));

  function toggle(id: string) {
    depIds = depIds.includes(id) ? depIds.filter(i => i !== id) : [...depIds, id];
  }
</script>

{#if visible.length > 0}
  <span class="field-label">Depends on mode</span>
  <div class="dep-mode">
    <button type="button" class:active={depMode === 'and'} onclick={() => depMode = 'and'}>AND</button>
    <button type="button" class:active={depMode === 'or'} onclick={() => depMode = 'or'}>OR</button>
  </div>
  <span class="field-label">Depends on</span>
  <div class="dep-picker">
    {#each visible as h (h.id)}
      <button type="button" class:selected={depIds.includes(h.id)} onclick={() => toggle(h.id)}>{h.title}</button>
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
  .dep-mode {
    display: flex;
    gap: 4px;
    margin-bottom: 0.5rem;
  }
  .dep-mode button {
    flex: 1;
    padding: 0.3rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    background: var(--card-bg, #f5f5f5);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
  }
  .dep-mode button.active {
    background: var(--accent, #0066cc);
    color: white;
    border-color: var(--accent, #0066cc);
  }
  .dep-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 0.75rem;
  }
  .dep-picker button {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    background: var(--card-bg, #f5f5f5);
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
  }
  .dep-picker button.selected {
    background: var(--accent, #0066cc);
    color: white;
    border-color: var(--accent, #0066cc);
  }
</style>
