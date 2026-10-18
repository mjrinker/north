<script lang="ts">
  import type { Habit } from '../types';
  import Icon from '@iconify/svelte';

  let { habits = [] as Habit[], linkedIds = $bindable([] as string[]), excludeId = '' } = $props();
  
  let visible = $derived(habits.filter(h => h.id !== excludeId && h.id));
  let open = $state(false);
  let search = $state('');

  let filtered = $derived(visible.filter(h => h.title.toLowerCase().includes(search.toLowerCase())));

  function toggle(id: string) {
    linkedIds = linkedIds.includes(id) ? linkedIds.filter(i => i !== id) : [...linkedIds, id];
  }

  function isSelected(id: string) {
    return linkedIds.includes(id);
  }
</script>

{#if visible.length > 0}
  <div class="dropdown-picker">
    <label class="dropdown-label">Linked with</label>

    <div class="dropdown-trigger" class:open={open} onclick={() => open = !open}>
      <span class="selected-count">{linkedIds.length} selected</span>
      <span class:rotated={open}><Icon icon="mdi:chevron-down" /></span>
    </div>

    {#if open}
      <div class="dropdown-menu" onclick={(e) => e.stopPropagation()}>
        <input type="text" class="dropdown-search" placeholder="Search habits" bind:value={search} onkeydown={(e) => e.stopPropagation()} />

        <p class="dropdown-hint">Logging on any linked habit logs the same value on all of them. Only habits of the same type can be linked.</p>

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
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .dropdown-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-2);
  }

  .dropdown-picker .mode-select {
    width: auto;
    min-height: 30px;
    padding: 2px 30px 2px var(--space-2);
    font-size: var(--text-sm);
    background-position: right 10px center;
  }

  .dropdown-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border-radius: var(--radius);
    background: var(--surface);
    cursor: pointer;
  }

  .dropdown-trigger.open {
    border-radius: var(--radius) var(--radius) 0 0;
  }

  .selected-count {
    color: var(--text);
  }

  .dropdown-trigger :global(svg) {
    font-size: 20px;
    color: var(--text-3);
    transition: transform 0.2s var(--ease);
  }

  .dropdown-trigger .rotated :global(svg) {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    margin-top: -6px;
    padding: 0 var(--space-2) var(--space-2);
    border-top: 0.5px solid var(--separator);
    border-radius: 0 0 var(--radius) var(--radius);
    background: var(--surface);
  }

  .dropdown-picker .dropdown-search {
    min-height: 36px;
    margin: var(--space-2) 0;
    background-color: var(--surface-2);
    border-radius: 10px;
  }

  .dropdown-hint {
    margin: 0 var(--space-1) var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-2);
  }

  .dropdown-list {
    max-height: 220px;
    overflow-y: auto;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 40px;
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--text);
    font-size: var(--text-base);
  }

  .dropdown-item:active {
    background: var(--surface-2);
  }

  .dropdown-item input[type='checkbox'] {
    accent-color: var(--accent);
    width: 18px;
    height: 18px;
  }

  .habit-title {
    flex: 1;
  }

  .dropdown-empty {
    padding: var(--space-3);
    text-align: center;
    color: var(--text-3);
    font-size: var(--text-sm);
  }
</style>
