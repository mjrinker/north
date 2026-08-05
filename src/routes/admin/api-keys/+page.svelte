<script lang="ts">
  import { userHasPermission } from '../../../lib/featureFlags';
  import { goto } from '$app/navigation';
  import { userRoles } from '../../../stores/roles';
  import { getAllUsersWithRoles } from '../../../stores/roles';
  import { getUserApiKeys, createUserApiKey, revokeUserApiKey, copyToClipboard, type ApiKey } from '../../../lib/apiKeys';

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
  <h1>API Keys</h1>
  <a href="/admin" class="back-link">← Back to Admin</a>

  {#if loading}
    <p class="status">Loading users...</p>
  {:else if users.length === 0}
    <p class="status">No users found.</p>
  {:else}
    <div class="user-picker">
      <label class="picker-label">User</label>
      <select bind:value={selectedUserId}>
        {#each users as u (u.id)}
          <option value={u.id}>{u.email}</option>
        {/each}
      </select>
    </div>

    <div class="key-section">
      <div class="mint-row">
        <input type="text" placeholder="Label (optional)" bind:value={newKeyName} disabled={busy} />
        <button class="btn" onclick={mintKey} disabled={busy}>{busy ? 'Creating…' : 'Mint key'}</button>
      </div>
      {#if msg}
        <p class="status">{msg}</p>
      {/if}
    </div>

    <div class="key-list">
      {#if keys.length === 0}
        <p class="status">No keys for this user.</p>
      {/if}
      {#each keys as k (k.id)}
        <div class="key-row">
          <div class="key-info">
            <span class="key-name">{k.name || 'Unnamed key'}</span>
            <span class="key-meta">Last used {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'never'}</span>
          </div>
          <div class="key-actions">
            <button class="btn" onclick={() => copyKey(k)}>Copy</button>
            <button class="btn btn-danger" onclick={() => revoke(k)}>Revoke</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { padding: 1.5rem; max-width: 700px; margin: 0 auto; }
  h1 { color: var(--text-primary, #222); }
  .back-link {
    display: inline-block;
    margin-bottom: 1.25rem;
    color: var(--text-primary, #222);
    font-size: 0.85rem;
    text-decoration: none;
  }
  .status { color: var(--text-secondary, #888); }
  .user-picker {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .picker-label { font-size: 0.9rem; font-weight: 500; color: var(--text-primary, #222); }
  .user-picker select {
    padding: 0.45rem 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    font-size: 0.9rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
  .key-section { margin-bottom: 1.25rem; }
  .mint-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    max-width: 420px;
  }
  .mint-row input {
    flex: 1;
    min-width: 0;
    padding: 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    font-size: 0.85rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
    box-sizing: border-box;
  }
  .btn {
    padding: 0.5rem 0.9rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    white-space: nowrap;
  }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .btn-danger {
    background: rgba(211, 47, 47, 0.1);
    color: #d32f2f;
    border-color: rgba(211, 47, 47, 0.3);
  }
  .key-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .key-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 8px;
  }
  .key-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .key-name { font-weight: 500; font-size: 0.9rem; color: var(--text-primary, #222); }
  .key-meta { font-size: 0.7rem; color: var(--text-secondary, #888); }
  .key-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
</style>