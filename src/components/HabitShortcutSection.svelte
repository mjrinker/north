<script lang="ts">
  import Icon from '@iconify/svelte';
  import type { HabitShortcuts, HabitType } from '../types';

  let { shortcuts = $bindable<HabitShortcuts>({}), type = 'binary' as HabitType } = $props();

  let open = $state(false);

  let showProgressEvents = $derived(type !== 'binary');
  let showStartEvent = $derived(type === 'duration');
</script>

<div class="shortcut-section">
  <button type="button" class="shortcut-toggle" onclick={() => open = !open} aria-expanded={open}>
    <span class="shortcut-title">iOS Shortcuts</span>
    <span class="shortcut-chevron" class:open><Icon icon="mdi:chevron-down" /></span>
  </button>

  {#if open}
    <p class="shortcut-hint">Runs a Shortcut from your device when the event happens. Enter the Shortcut's name — it's invoked as <code>shortcuts://run-shortcut?name=&lt;Name&gt;&amp;input=text&amp;text=&lt;json&gt;</code>, with the JSON body (same fields as the webhook payload) passed to it. Leave blank to disable an event.</p>
    {#if showStartEvent}
      <label for="sc-start">Start Shortcut (duration)</label>
      <input id="sc-start" type="text" placeholder="Habit Started" bind:value={shortcuts.start} />
    {/if}
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
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shortcut-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
  }

  .shortcut-chevron {
    display: inline-flex;
    color: var(--text-3);
    font-size: 20px;
    transition: transform 0.2s var(--ease);
  }

  .shortcut-chevron.open {
    transform: rotate(180deg);
  }

  .shortcut-hint {
    margin: var(--space-1) var(--space-1) var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-2);
    line-height: 1.45;
  }

  .shortcut-hint code {
    font-family: var(--font-mono);
    font-size: 0.9em;
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--surface-2);
    word-break: break-all;
  }

  label {
    margin: var(--space-2) var(--space-1) 0;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-2);
  }

  input {
    width: 100%;
    min-height: var(--tap);
    padding: 10px var(--space-3);
    border: none;
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
  }

  input:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent);
  }
</style>
