<script lang="ts">
  import { gql } from '../../lib/api';
  import Icon from '@iconify/svelte';
  import Modal from '../Modal.svelte';

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
        `mutation { createAccountabilityInvitation { id shortCode } }`,
        {}
      );
      if (result?.createAccountabilityInvitation?.shortCode) {
        inviteLink = `${window.location.origin}/accountability/invite/${result.createAccountabilityInvitation.shortCode}`;
        showLink = true;
      }
      onInviteSent();
    } catch (e: any) {
      console.error('[InviteModal] Error:', e);
      error = e.message ?? 'Failed to create invitation';
    }
    creating = false;
  }

  let copied = $state(false);

  async function shareLink() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Be my accountability partner on North', url: inviteLink }); return; } catch {}
    }
    await navigator.clipboard.writeText(inviteLink);
    copied = true;
  }
</script>

<Modal {onClose}>
  {#if showLink}
    <h2>Invite link ready</h2>
    <p class="desc">Send it to your partner. It works on any device and expires in 7 days.</p>
    <div class="link-box">
      <input type="text" value={inviteLink} readonly aria-label="Invite link" onfocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
    </div>
    <div class="actions">
      <button class="btn btn-secondary" onclick={() => { showLink = false; onClose(); }}>Done</button>
      <button class="btn" onclick={shareLink}><Icon icon={copied ? 'mdi:check' : 'mdi:export-variant'} />{copied ? 'Copied' : 'Share'}</button>
    </div>
  {:else}
    <h2>Invite a partner</h2>
    <p class="desc">You’ll get a link to send however you like. Once they accept, you each choose which habits to share.</p>
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
    <div class="actions">
      <button class="btn btn-secondary" onclick={onClose} disabled={creating}>Cancel</button>
      <button class="btn" onclick={createInvite} disabled={creating}>{creating ? 'Creating…' : 'Create link'}</button>
    </div>
  {/if}
</Modal>

<style>
  h2 { margin-bottom: var(--space-2); }

  .desc {
    color: var(--text-2);
    margin-bottom: var(--space-4);
  }

  .link-box input {
    font-family: var(--font-mono);
    font-size: 14px;
  }

  .error {
    padding: var(--space-3);
    margin-bottom: var(--space-3);
    border-radius: var(--radius);
    background: var(--danger-soft);
    color: var(--danger);
    font-size: var(--text-sm);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-5);
  }

  .actions .btn { min-width: 96px; }
</style>
