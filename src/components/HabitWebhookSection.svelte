<script lang="ts">
  import Icon from '@iconify/svelte';
  import type { HabitWebhooks, HabitType } from '../types';

  let { webhooks = $bindable<HabitWebhooks>({}), type = 'binary' as HabitType } = $props();

  let open = $state(false);

  let showProgressEvents = $derived(type !== 'binary');
  let showStartEvent = $derived(type === 'duration');
</script>

<div class="webhook-section">
  <button type="button" class="webhook-toggle" onclick={() => open = !open} aria-expanded={open}>
    <span class="webhook-title">Webhooks</span>
    <span class="webhook-chevron" class:open><Icon icon="mdi:chevron-down" /></span>
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
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .webhook-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
  }

  .webhook-chevron {
    display: inline-flex;
    color: var(--text-3);
    font-size: 20px;
    transition: transform 0.2s var(--ease);
  }

  .webhook-chevron.open {
    transform: rotate(180deg);
  }

  .webhook-hint {
    margin: var(--space-1) var(--space-1) var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-2);
    line-height: 1.45;
  }

  .webhook-hint code {
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
