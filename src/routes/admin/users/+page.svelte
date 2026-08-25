<script lang="ts">
  import { userHasPermission } from '../../../lib/featureFlags';
  import { goto } from '$app/navigation';
  import { userRoles, getAllUsersWithRoles, setUserRoles } from '../../../stores/roles';
  import { gql } from '../../../lib/api';
  import Icon from '@iconify/svelte';

export const ssr = false;

  let roles = $state<string[]>([]);
  userRoles.subscribe(v => { roles = v; if (!userHasPermission(roles, 'manage_roles')) goto('/admin'); });

  let users = $state<{ id: string; email: string; name: string; roles: string[] }[]>([]);
  let loading = $state(true);
  let saving = $state<string | null>(null);

  let allRoleDefs = $state<{ name: string; label: string }[]>([]);
  let editingUserId: string | null = $state(null);
  let selectedRoles = $state<string[]>([]);

  async function loadUsers() {
    loading = true;
    try {
      const [usersData, rolesData] = await Promise.all([
        getAllUsersWithRoles(),
        gql<{ roleDefs: { name: string; label: string }[] }>(`query { roleDefs { name label } }`)
      ]);
      users = usersData.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name ?? '',
        roles: u.roles ?? [],
      }));
      allRoleDefs = rolesData?.roleDefs ?? [];
    } catch (e: any) {
      console.error('loadUsers error:', e?.message);
      users = [];
    }
    loading = false;
  }

  $effect(() => { loadUsers(); });

  function openEditRoles(user: { id: string; email: string; roles: string[] }) {
    editingUserId = user.id;
    selectedRoles = [...user.roles];
  }

  function closeEditRoles() {
    editingUserId = null;
    selectedRoles = [];
  }

  function toggleRoleInSelection(role: string) {
    const idx = selectedRoles.indexOf(role);
    if (idx >= 0) selectedRoles.splice(idx, 1);
    else selectedRoles.push(role);
  }

  async function saveRoles() {
    if (!editingUserId) return;
    saving = editingUserId;
    try {
      await setUserRoles(editingUserId, selectedRoles);
      const u = users.find(x => x.id === editingUserId);
      if (u) u.roles = [...selectedRoles];
      users = [...users];
    } catch (e) {
      console.error('setUserRoles error:', e);
    }
    saving = null;
    closeEditRoles();
  }
</script>

<div class="page">
  <h1>User Management</h1>
  <a href="/admin" class="back-link">← Back to Admin</a>

  {#if loading}
    <p class="status">Loading users...</p>
  {:else if users.length === 0}
    <p class="status">No users found.</p>
  {:else}
    <div class="user-list">
      {#each users as u (u.id)}
        <div class="user-row">
          <div class="user-info">
            <span class="user-email">{u.email}</span>
            <span class="user-id">{u.id.slice(0, 8)}…</span>
          </div>
          <div class="user-roles">
            {#if u.roles.length}
              <span class="role-badge" class:admin={u.roles.includes('admin')}>
                {u.roles.map(r => {
                  const def = allRoleDefs.find(d => d.name === r);
                  return def ? def.label : r;
                }).join(', ')}
              </span>
            {:else}
              <span class="no-roles">No roles</span>
            {/if}
            <button class="btn-edit" onclick={() => openEditRoles(u)} disabled={saving === u.id} aria-label="Edit roles">
              <Icon icon="mdi:pencil" size="16" />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if editingUserId}
  <div class="modal-overlay" onclick={closeEditRoles}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>Edit Roles</h2>
        <button class="modal-close" onclick={closeEditRoles} aria-label="Close">
          <Icon icon="mdi:close" size="20" />
        </button>
      </div>
      <div class="modal-body">
        <label class="multiselect-label">Roles</label>
        <div class="multiselect" tabindex="0" role="combobox" aria-expanded="true" aria-haspopup="listbox">
          <div class="multiselect-selected">
            {#if selectedRoles.length === 0}
              <span class="placeholder">Select roles...</span>
            {:else}
              {#each selectedRoles as r}
                <span class="chip">
                  {(() => {
                    const def = allRoleDefs.find(d => d.name === r);
                    return def ? def.label : r;
                  })()}
                  <button class="chip-remove" onclick={() => toggleRoleInSelection(r)} aria-label="Remove">×</button>
                </span>
              {/each}
            {/if}
          </div>
          <div class="multiselect-dropdown" role="listbox">
            {#each allRoleDefs as def}
              <button
                class="dropdown-option" class:selected={selectedRoles.includes(def.name)}
                role="option"
                aria-selected={selectedRoles.includes(def.name)}
                onclick={() => toggleRoleInSelection(def.name)}
              >
                <Icon icon={selectedRoles.includes(def.name) ? 'mdi:checkbox-marked' : 'mdi:checkbox-blank-outline'} size="18" />
                {def.label}
              </button>
            {/each}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={closeEditRoles}>Cancel</button>
        <button class="btn" onclick={saveRoles} disabled={saving}>Save</button>
      </div>
    </div>
  </div>
{/if}

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
  .user-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .user-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 8px;
  }
  .user-info { display: flex; flex-direction: column; gap: 2px; }
  .user-email { font-weight: 500; font-size: 0.9rem; color: var(--text-primary, #222); }
  .user-id { font-size: 0.7rem; color: var(--text-secondary, #888); }
  .user-roles { display: flex; align-items: center; gap: 0.5rem; }
  .role-badge {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
  }
  .role-badge.admin {
    background: #fee2e2;
    color: #dc2626;
  }
  .no-roles { font-size: 0.8rem; color: var(--text-secondary, #888); }
  .btn-edit {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-secondary, #666);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .btn-edit:hover:not(:disabled) {
    background: var(--accent, #0066cc);
    color: white;
  }
  .btn-edit:disabled { opacity: 0.5; cursor: not-allowed; }

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
    max-width: 400px;
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
  .multiselect-label { display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary, #666); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .multiselect { position: relative; }
  .multiselect-selected {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    min-height: 42px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 8px;
    background: var(--input-bg, #fff);
    cursor: pointer;
    align-items: center;
  }
  .placeholder { color: var(--text-secondary, #999); font-size: 0.9rem; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.5rem 0.15rem 0.35rem;
    background: var(--accent, #0066cc);
    color: white;
    font-size: 0.8rem;
    font-weight: 500;
    border-radius: 999px;
  }
  .chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    background: rgba(255,255,255,0.2);
    color: white;
    border-radius: 50%;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    padding: 0;
  }
  .chip-remove:hover { background: rgba(255,255,255,0.3); }
  .multiselect-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #ccc);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    max-height: 250px;
    overflow-y: auto;
    z-index: 100;
  }
  .dropdown-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: none;
    background: transparent;
    font-size: 0.9rem;
    color: var(--text-primary, #222);
    text-align: left;
    cursor: pointer;
  }
  .dropdown-option:hover { background: var(--btn-secondary-bg, #f5f5f5); }
  .dropdown-option.selected { background: rgba(0, 102, 204, 0.1); }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--card-border, #e0e0e0);
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
</style>