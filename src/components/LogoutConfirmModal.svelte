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
    Clear all local data (habits, history, settings, etc.) from this device before
    signing out? Your cloud data will not be affected.
  </p>
  {#if busy}
    <p class="busy">Signing out…</p>
  {/if}
  <div class="actions">
    <div class="actions-column">
      <button class="btn btn-keep" onclick={handleLogoutOnly} disabled={busy}>
        Sign out, keep data
      </button>
      <button class="btn btn-clear" onclick={handleLogoutAndClear} disabled={busy}>
        Sign out &amp; clear local data
      </button>
    </div>
    <button class="btn btn-cancel" onclick={onClose} disabled={busy}>Cancel</button>
  </div>
</Modal>

<style>
  h2 {
    margin: 0 0 0.5rem;
    color: var(--text-primary, #222);
  }
  .desc {
    margin: 0 0 1rem;
    font-size: 0.9rem;
    color: var(--text-secondary, #555);
  }
  .busy {
    margin: 0 0 1rem;
    font-size: 0.85rem;
    color: var(--text-secondary, #888);
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
  }
  .actions-column {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .btn {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border-radius: 0;
    border: 1px solid var(--card-border, #ccc);
    background: transparent;
    color: var(--text-primary, #222);
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    font-family: inherit;
    box-sizing: border-box;
  }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .btn-clear {
    background: #d32f2f;
    border-color: #d32f2f;
    color: #fff;
  }
  .btn-clear:hover { opacity: 0.9; }
  .btn-cancel {
    border-color: var(--card-border, #ccc);
  }
  .btn-cancel:hover { background: var(--btn-secondary-bg, #eee); }
</style>