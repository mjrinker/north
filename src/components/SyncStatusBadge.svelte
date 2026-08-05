<script lang="ts">
  import { syncStatus } from '../services/sync';
  import { appSettings } from '../lib/settings';
</script>

{#if $appSettings.showSyncStatus}
  <button class="sync-status" disabled data-state={$syncStatus.syncing ? 'syncing' : (!$syncStatus.online ? 'offline' : $syncStatus.pending > 0 ? 'pending' : 'ok')} title={$syncStatus.pending > 0 ? `${$syncStatus.pending} change${$syncStatus.pending === 1 ? '' : 's'} queued, will sync when online` : $syncStatus.online ? 'All synced' : 'Offline'}>
    {#if $syncStatus.syncing}
      <span class="dot" aria-hidden="true"></span>Syncing…
    {:else if !$syncStatus.online}
      <span class="dot" aria-hidden="true"></span>Offline
    {:else if $syncStatus.pending > 0}
      <span class="dot" aria-hidden="true"></span>{$syncStatus.pending} queued
    {:else}
      <span class="dot" aria-hidden="true"></span>Synced
    {/if}
  </button>
{/if}

<style>
  .sync-status {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin: 0 auto;
    font-size: 0.68rem;
    color: var(--text-secondary, #888);
    background: transparent;
    border: none;
    cursor: default;
    white-space: nowrap;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-secondary, #888);
    flex: none;
  }
  .sync-status[data-state='ok'] .dot { background: #2e9e5b; }
  .sync-status[data-state='pending'] .dot { background: #f59e0b; }
  .sync-status[data-state='offline'] .dot { background: #e5484d; }
  .sync-status[data-state='syncing'] .dot { background: #4f8ef7; animation: pulse 1s infinite; }

  @keyframes pulse {
    50% { opacity: 0.3; }
  }
</style>