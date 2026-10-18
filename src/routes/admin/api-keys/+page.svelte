<script lang="ts">
  import Icon from '@iconify/svelte';
  import { userHasPermission } from '../../../lib/featureFlags';
  import { goto } from '$app/navigation';
  import { userRoles } from '../../../stores/roles';
  import { getAllUsersWithRoles } from '../../../stores/roles';
  import { getUserApiKeys, createUserApiKey, revokeUserApiKey, copyToClipboard, type ApiKey } from '../../../lib/apiKeys';

export const ssr = false;

  let roles = $state<string[]>([]);
  userRoles.subscribe(v => { roles = v; if (!userHasPermission(roles, 'access_admin')) goto('/admin'); });

  let users = $state<{ id: string; email: string }[]>([]);
  let selectedUserId = $state<string | null>(null);
  let keys = $state<ApiKey[]>([]);
  let loading = $state(true);
  let busy = $state(false);
  let newKeyName = $state('');
  let msg = $state('');

  let selectedUser = $derived(users.find(u => u.id === selectedUserId) ?? null);

  async function loadUsers() {
    loading = true;
    try {
      const data = await getAllUsersWithRoles();
      users = data.map((u: any) => ({ id: u.id, email: u.email }));
      if (users.length > 0 && !selectedUserId) {
        selectedUserId = users[0].id;
      } else if (users.length === 0) {
        selectedUserId = null;
      }
    } catch (e: any) {
      console.error('loadUsers error:', e?.message);
      users = [];
    }
    loading = false;
  }

  async function loadKeys() {
    if (!selectedUserId) { keys = []; return; }
    try {
      keys = await getUserApiKeys(selectedUserId);
    } catch (e: any) {
      msg = `Could not load keys: ${e.message}`;
      keys = [];
    }
  }

  $effect(() => { loadUsers(); });

  $effect(() => { loadKeys(); });

  async function mintKey() {
    if (!selectedUserId || busy) return;
    busy = true;
    msg = '';
    try {
      const key = await createUserApiKey(selectedUserId, newKeyName.trim() || undefined);
      await loadKeys();
      newKeyName = '';
      msg = `Created key for ${selectedUser?.email ?? 'user'}. Copied to clipboard.`;
      await copyToClipboard(key.apiKey);
    } catch (e: any) {
      msg = `Could not create key: ${e.message}`;
    }
    busy = false;
  }

  async function copyKey(k: ApiKey) {
    const ok = await copyToClipboard(k.apiKey);
    msg = ok ? 'Key copied to clipboard.' : 'Copy failed';
  }

  async function revoke(k: ApiKey) {
    if (!confirm(`Revoke key "${k.name || 'unnamed key'}"?`)) return;
    try {
      await revokeUserApiKey(k.id);
      keys = keys.filter(x => x.id !== k.id);
      msg = 'Key revoked.';
    } catch (e: any) {
      msg = `Could not revoke key: ${e.message}`;
    }
  }
</script>

<div class="page">
  <a class="back" href="/admin"><Icon icon="mdi:chevron-left" />Admin</a>
  <h1 class="page-title">API keys</h1>

  {#if loading}
    <p class="empty">Loading users…</p>
  {:else if users.length === 0}
    <p class="empty">No users yet.</p>
  {:else}
    <div class="group">
      <div class="row">
        <span class="row-label">User</span>
        <select class="inline-select" bind:value={selectedUserId} aria-label="User">
          {#each users as u (u.id)}
            <option value={u.id}>{u.email}</option>
          {/each}
        </select>
      </div>
    </div>

    <h2 class="section-label">Keys</h2>
    <div class="group">
      {#each keys as k (k.id)}
        <div class="row">
          <div class="row-label">
            <div class="key-name">{k.name || 'Unnamed key'}</div>
            <div class="key-meta">Last used {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'never'}</div>
          </div>
          <button class="btn btn-sm btn-secondary" onclick={() => copyKey(k)}>Copy</button>
          <button class="btn btn-sm btn-danger" onclick={() => revoke(k)}>Revoke</button>
        </div>
      {/each}
      <div class="row">
        <input class="row-input" type="text" placeholder="New key name" bind:value={newKeyName} disabled={busy} aria-label="New key name" />
        <button class="btn btn-sm" onclick={mintKey} disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
      </div>
    </div>
    {#if msg}<p class="section-footnote">{msg}</p>{/if}
  {/if}
</div>

<style>
  .back {
    display: inline-flex;
    align-items: center;
    margin-left: -6px;
  }

  .back :global(svg) { font-size: 22px; }

  .inline-select {
    max-width: 65%;
    min-height: 32px;
    padding: 4px 28px 4px var(--space-2);
    border: none;
    border-radius: var(--radius-sm);
    background: var(--surface-2) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none' stroke='%23908d89' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E") no-repeat right 10px center;
    color: var(--text);
    appearance: none;
    -webkit-appearance: none;
    font-size: var(--text-base);
  }
  .key-name { font-weight: 500; }
  .key-meta { font-size: var(--text-sm); color: var(--text-2); }
  .row-input { flex: 1; min-width: 0; min-height: 32px; border: none; background: none; color: var(--text); outline: none; }
</style>
