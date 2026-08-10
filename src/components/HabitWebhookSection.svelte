<script lang="ts">
  import type { HabitWebhooks, HabitType } from '../types';

  let { webhooks = $bindable<HabitWebhooks>({}), type = 'binary' as HabitType } = $props();

  let open = $state(false);

  let showProgressEvents = $derived(type !== 'binary');
  let showStartEvent = $derived(type === 'duration');
</script>

<div class="webhook-section">
  <button type="button" class="webhook-toggle" onclick={() => open = !open} aria-expanded={open}>
    <span class="webhook-title">Webhooks</span>
    <span class="webhook-chevron">{open ? '▲' : '▼'}</span>
  </button>

  {#if open}
    <p class="webhook-hint">Fired locally from your device when the event happens. URL placeholders like <code>&#123;&#123;value&#125;&#125;</code>, <code>&#123;&#123;date&#125;&#125;</code>, <code>&#123;&#123;id&#125;&#125;</code>, <code>&#123;&#123;title&#125;&#125;</code>, <code>&#123;&#123;unit&#125;&#125;</code>, <code>&#123;&#123;standard&#125;&#125;</code>, <code>&#123;&#123;event&#125;&#125;</code> are replaced on invocation. Leave blank to disable an event.</p>
    {#if showStartEvent}
      <label for="wh-start">Start URL (duration)</label>
      <input id="wh-start" type="url" placeholder="https://example.com/hooks/start" bind:value={webhooks.start} />
    {/if}
    <label for="wh-logged">Logged URL</label>
    <input id="wh-logged" type="url" placeholder="https://example.com/hooks/logged" bind:value={webhooks.logged} />

    {#if showProgressEvents}
      <label for="wh-standard">Standard met URL (quantity / duration)</label>
      <input id="wh-standard" type="url" placeholder="https://example.com/hooks/standard" bind:value={webhooks.standard_met} />

      <label for="wh-target">Target met URL (quantity / duration)</label>
      <input id="wh-target" type="url" placeholder="https://example.com/hooks/target" bind:value={webhooks.target_met} />
    {:else}
      <label for="wh-completed">Completed URL (binary)</label>
      <input id="wh-completed" type="url" placeholder="https://example.com/hooks/completed" bind:value={webhooks.completed} />
    {/if}
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
    border-radius: 0;
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
    border-radius: 0;
    font-size: 0.9rem;
    box-sizing: border-box;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
</style>