<script lang="ts">
  import type { HabitWebhooks } from '../types';

  let { webhooks = $bindable<HabitWebhooks>({}) } = $props();

  let open = $state(false);
</script>

<div class="webhook-section">
  <button type="button" class="webhook-toggle" onclick={() => open = !open} aria-expanded={open}>
    <span class="webhook-title">Webhooks</span>
    <span class="webhook-chevron">{open ? '▲' : '▼'}</span>
  </button>

  {#if open}
    <p class="webhook-hint">Fired locally from your device when the event happens. Leave blank to disable an event.</p>
    <label for="wh-logged">Logged URL</label>
    <input id="wh-logged" type="url" placeholder="https://example.com/hooks/logged" bind:value={webhooks.logged} />

    <label for="wh-standard">Standard met URL (quantity / duration)</label>
    <input id="wh-standard" type="url" placeholder="https://example.com/hooks/standard" bind:value={webhooks.standard_met} />

    <label for="wh-target">Target met URL (quantity / duration)</label>
    <input id="wh-target" type="url" placeholder="https://example.com/hooks/target" bind:value={webhooks.target_met} />

    <label for="wh-completed">Completed URL (binary)</label>
    <input id="wh-completed" type="url" placeholder="https://example.com/hooks/completed" bind:value={webhooks.completed} />
  {/if}
</div>

<style>
  .webhook-section {
    margin: 0.25rem 0 0.75rem;
  }
  .webhook-toggle {
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
  .webhook-toggle:hover { background: var(--card-border, #ddd); }
  .webhook-chevron { font-size: 0.7rem; color: var(--text-secondary, #888); }
  .webhook-hint { font-size: 0.78rem; color: var(--text-secondary, #888); margin: 0.5rem 0 0.6rem; }
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