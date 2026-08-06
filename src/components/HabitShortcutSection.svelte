<script lang="ts">
  import type { HabitShortcuts, HabitType } from '../types';

  let { shortcuts = $bindable<HabitShortcuts>({}), type = 'binary' as HabitType } = $props();

  let open = $state(false);

  let showProgressEvents = $derived(type !== 'binary');
</script>

<div class="shortcut-section">
  <button type="button" class="shortcut-toggle" onclick={() => open = !open} aria-expanded={open}>
    <span class="shortcut-title">iOS Shortcuts</span>
    <span class="shortcut-chevron">{open ? '▲' : '▼'}</span>
  </button>

  {#if open}
    <p class="shortcut-hint">Runs a Shortcut from your device when the event happens. Enter the Shortcut's name — it's invoked as <code>shortcuts://run-shortcut?name=&lt;Name&gt;&amp;input=text&amp;text=&lt;json&gt;</code>, with the JSON body (same fields as the webhook payload) passed to it. Leave blank to disable an event.</p>
    <label for="sc-logged">Shortcut on log</label>
    <input id="sc-logged" type="text" placeholder="Add Habit Log" bind:value={shortcuts.logged} />

    {#if showProgressEvents}
      <label for="sc-standard">Shortcut on standard met (quantity / duration)</label>
      <input id="sc-standard" type="text" placeholder="Habit Standard Met" bind:value={shortcuts.standard_met} />

      <label for="sc-target">Shortcut on target met (quantity / duration)</label>
      <input id="sc-target" type="text" placeholder="Habit Target Met" bind:value={shortcuts.target_met} />
    {:else}
      <label for="sc-completed">Shortcut on completed (binary)</label>
      <input id="sc-completed" type="text" placeholder="Habit Completed" bind:value={shortcuts.completed} />
    {/if}
  {/if}
</div>

<style>
  .shortcut-section {
    margin: 0.25rem 0 0.75rem;
  }
  .shortcut-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.55rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }
  .shortcut-toggle:hover { background: var(--card-border, #ddd); }
  .shortcut-chevron { font-size: 0.7rem; color: var(--text-secondary, #888); }
  .shortcut-hint { font-size: 0.78rem; color: var(--text-secondary, #888); margin: 0.5rem 0 0.6rem; }
  label {
    display: block;
    margin: 0.5rem 0 0.25rem;
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--text-primary, #222);
  }
  input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    font-size: 0.9rem;
    box-sizing: border-box;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
</style>
