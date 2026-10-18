<script lang="ts">
  import { signOut } from '../stores/auth';
  import { clearLocalData } from '../services/resetData';
  import Modal from './Modal.svelte';

  let { onClose }: { onClose: () => void } = $props();

  let busy = $state(false);

  async function handleLogoutOnly() {
    if (busy) return;
    busy = true;
    await signOut();
    onClose();
  }

  async function handleLogoutAndClear() {
    if (busy) return;
    busy = true;
    await signOut();
    await clearLocalData();
    onClose();
  }
</script>

<Modal {onClose}>
  <h2 class="title">Sign out</h2>
  <p class="desc">
    Do you also want to remove your habits and history from this device? What’s
    synced to your account stays either way.
  </p>
  {#if busy}
    <p class="busy">Signing out…</p>
  {/if}
  <div class="actions">
    <div class="actions-column">
      <button class="btn btn-secondary" onclick={handleLogoutOnly} disabled={busy}>
        Sign out, keep data
      </button>
      <button class="btn btn-danger" onclick={handleLogoutAndClear} disabled={busy}>
        Sign out and remove from this device
      </button>
    </div>
    <button class="btn btn-plain" onclick={onClose} disabled={busy}>Cancel</button>
  </div>
</Modal>

<style>
  .title {
    margin-bottom: var(--space-2);
  }

  .desc {
    color: var(--text-2);
    margin-bottom: var(--space-5);
  }

  .busy {
    color: var(--text-2);
    font-size: var(--text-sm);
    margin-bottom: var(--space-3);
  }

  .actions,
  .actions-column {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .actions .btn {
    width: 100%;
  }
</style>
