<script lang="ts">
  import { gql } from '../../lib/api';
  import Icon from '@iconify/svelte';

  let { onClose, onInviteSent }: { onClose: () => void; onInviteSent: () => void } = $props();

  let creating = $state(false);
  let error = $state('');
  let showLink = $state(false);
  let inviteLink = $state('');

  async function createInvite() {
    error = '';
    creating = true;
    try {
      const result = await gql<{ createAccountabilityInvitation: any }>(
        `mutation { createAccountabilityInvitation(email: "", message: "") { id } }`,
        {}
      );
      if (result?.createAccountabilityInvitation?.id) {
        inviteLink = `${window.location.origin}/accountability/invite/${result.createAccountabilityInvitation.id}`;
        showLink = true;
      }
      onInviteSent();
    } catch (e: any) {
      error = e.message ?? 'Failed to create invitation';
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
    alert('Link copied!');
  }
</script>

<div class="modal-overlay" onclick={onClose}>
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>Invite Accountability Partner</h2>
      <button class="modal-close" onclick={onClose} aria-label="Close">
        <Icon icon="mdi:close" size="20" />
      </button>
    </div>
    <div class="modal-body">
      {#if showLink}
        <div class="success-state">
          <div class="success-icon">
            <Icon icon="mdi:check-circle" size="48" />
          </div>
          <h3>Invitation Link Created!</h3>
          <p>Share this link with your partner:</p>
          <div class="link-box">
            <input type="text" value={inviteLink} readonly />
            <button class="btn" onclick={copyLink}>
              <Icon icon="mdi:content-copy" /> Copy
            </button>
          </div>
          <p class="hint">They can open this link on any device. If they don't have an account, they'll be prompted to create one.</p>
          <button class="btn btn-secondary" onclick={() => { showLink = false; onClose(); }}>Done</button>
        </div>
      {:else}
        <p class="modal-description">Create a shareable link to invite someone as your accountability partner. No email needed — just share the link however you want.</p>

        {#if error}
          <div class="error-banner">{error}</div>
        {/if}

        <div class="form-actions">
          <button class="btn btn-secondary" onclick={onClose} disabled={creating}>Cancel</button>
          <button class="btn" onclick={createInvite} disabled={creating}>
            {creating ? 'Creating...' : 'Create Invite Link'}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  .modal {
    background: var(--card-bg, #fff);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--card-border, #e0e0e0);
  }
  .modal-header h2 { margin: 0; font-size: 1.1rem; }
  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #666);
    border-radius: 6px;
    cursor: pointer;
  }
  .modal-close:hover { background: var(--btn-secondary-bg, #eee); }
  .modal-body { padding: 1.25rem; }
  .modal-description { color: var(--text-secondary, #666); margin-bottom: 1rem; font-size: 0.9rem; }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-secondary { background: var(--btn-secondary-bg, #eee); color: var(--text-primary, #222); }
  .btn-secondary:hover:not(:disabled) { background: var(--btn-secondary-hover, #ddd); }

  .success-state { text-align: center; }
  .success-icon { color: #22c55e; margin-bottom: 1rem; }
  .success-state h3 { margin: 0 0 0.5rem; font-size: 1.2rem; }
  .success-state p { color: var(--text-secondary, #666); margin: 0 0 1rem; }
  .link-box {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .link-box input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 8px;
    font-size: 0.85rem;
    background: var(--input-bg, #f5f5f5);
  }
  .hint { font-size: 0.8rem; color: var(--text-secondary, #888); margin-bottom: 1.5rem; }
  .error-banner {
    padding: 0.75rem;
    background: #fee2e2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.85rem;
  }
</style>