<script lang="ts">
  import type { Habit } from '../types';
  import Icon from '@iconify/svelte';

  let { habits = [] as Habit[], depIds = $bindable([] as string[]), depMode = $bindable<'and' | 'or'>('and'), excludeId = '' } = $props();
  
  let visible = $derived(habits.filter(h => h.id !== excludeId && h.id));
  let open = $state(false);
  let search = $state('');
  let selectedMode = $derived(depMode);

  let filtered = $derived(visible.filter(h => h.title.toLowerCase().includes(search.toLowerCase())));

  function toggle(id: string) {
    depIds = depIds.includes(id) ? depIds.filter(i => i !== id) : [...depIds, id];
  }

  function isSelected(id: string) {
    return depIds.includes(id);
  }

  function setMode(mode: 'and' | 'or') {
    depMode = mode;
  }
</script>

{#if visible.length > 0}
  <div class="dropdown-picker">
    <label class="dropdown-label">
      Depends on
      <select bind:value={selectedMode} class="mode-select" onchange={(e) => setMode((e.target as HTMLSelectElement).value as 'and' | 'or')}>
        <option value="and">AND (all must be done)</option>
        <option value="or">OR (any can be done)</option>
      </select>
    </label>

    <div class="dropdown-trigger" class:open={open} onclick={() => open = !open}>
      <span class="selected-count">{depIds.length} selected</span>
      <span class:rotated={open}><Icon icon="mdi:chevron-down" /></span>
    </div>

    {#if open}
      <div class="dropdown-menu" onclick={(e) => e.stopPropagation()}>
        <input type="text" class="dropdown-search" placeholder="Search habits..." bind:value={search} onkeydown={(e) => e.stopPropagation()} />

        <div class="dropdown-list">
          {#each filtered as h (h.id)}
            <label class="dropdown-item" class:selected={isSelected(h.id)}>
              <input type="checkbox" checked={isSelected(h.id)} onchange={() => toggle(h.id)} />
              <span class="habit-title">{h.title}</span>
            </label>
          {/each}
          {#if filtered.length === 0}
            <div class="dropdown-empty">No habits match</div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .dropdown-picker {
    margin-bottom: 0.75rem;
  }
  .dropdown-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary, #222);
  }
  .mode-select {
    flex: 1;
    padding: 0.4rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
    font-size: 0.85rem;
  }
  .dropdown-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    background: var(--input-bg, #fff);
    cursor: pointer;
    color: var(--text-primary, #222);
    font-size: 0.9rem;
  }
  .dropdown-trigger:hover {
    background: var(--btn-secondary-bg, #f5f5f5);
  }
  .selected-count {
    font-weight: 500;
  }
  .dropdown-trigger :global(svg) {
    transition: transform 0.2s;
    font-size: 1.2rem;
  }
  .dropdown-trigger :global(svg).rotated {
    transform: rotate(180deg);
  }
  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.25rem;
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #ccc);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    max-height: 300px;
    display: flex;
    flex-direction: column;
  }
  .dropdown-search {
    padding: 0.5rem;
    border: none;
    border-bottom: 1px solid var(--card-border, #ccc);
    border-radius: 8px 8px 0 0;
    background: var(--input-bg, #f5f5f5);
    font-size: 0.9rem;
    width: 100%;
    box-sizing: border-box;
  }
  .dropdown-list {
    overflow-y: auto;
    max-height: 220px;
  }
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    transition: background 0.15s;
  }
  .dropdown-item:hover {
    background: var(--btn-secondary-bg, #f5f5f5);
  }
  .dropdown-item.selected {
    background: rgba(0, 102, 204, 0.1);
  }
  .dropdown-item input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    accent-color: var(--accent, #0066cc);
  }
  .habit-title {
    flex: 1;
    font-size: 0.9rem;
    color: var(--text-primary, #222);
  }
  .dropdown-empty {
    padding: 1rem;
    text-align: center;
    color: var(--text-secondary, #888);
    font-size: 0.85rem;
  }
</style>