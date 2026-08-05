<script lang="ts">
  import { syncStatus } from '../services/sync';
  import { appSettings } from '../lib/settings';

  let visible = $state(false);
  let text = $state('');
  let kind = $state<'syncing' | 'pending' | 'offline' | 'ok'>('ok');
  let hideTimer = $state<ReturnType<typeof setTimeout> | undefined>(undefined);

  function clearTimer() {
    if (hideTimer != null) {
      clearTimeout(hideTimer);
      hideTimer = undefined;
    }
  }

  $effect(() => {
    if (!$appSettings.showSyncStatus) {
      visible = false;
      clearTimer();
      return;
    }
    const s = $syncStatus;
    if (s.syncing) {
      clearTimer();
      visible = true;
      kind = 'syncing';
      text = s.online ? 'Syncing…' : 'Syncing… (offline)';
    } else if (s.pending > 0) {
      clearTimer();
      visible = true;
      kind = 'pending';
      text = `${s.pending} change${s.pending === 1 ? '' : 's'} queued`;
    } else if (!s.online) {
      clearTimer();
      visible = true;
      kind = 'offline';
      text = 'Offline';
    } else {
      if (visible) {
        text = 'Synced';
        kind = 'ok';
        clearTimer();
        hideTimer = setTimeout(() => {
          visible = false;
        }, 2500);
      }
    }
  });
</script>

{#if visible}
  <div class="sync-banner {kind}" role="status">
    <span class="dot" aria-hidden="true"></span>
    {text}
  </div>
{/if}

<style>
  .sync-banner {
    position: sticky;
    top: 0.4rem;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0 0 0.6rem;
    padding: 0.45rem 0.8rem;
    width: fit-content;
    max-width: 100%;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text-primary, #222);
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e2e2e2);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
    background: var(--text-secondary, #888);
  }
  .sync-banner.syncing .dot { background: #4f8ef7; animation: pulse 1s infinite; }
  .sync-banner.pending .dot { background: #f59e0b; }
  .sync-banner.offline .dot { background: #e5484d; }
  .sync-banner.ok .dot { background: #2e9e5b; }

  @keyframes pulse {
    50% { opacity: 0.3; }
  }
</style>