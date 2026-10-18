<script lang="ts">
  import { userHasPermission } from '../../../lib/featureFlags';
  import { goto } from '$app/navigation';
  import { userRoles, getAllUsersWithRoles, setUserRoles } from '../../../stores/roles';
  import { gql } from '../../../lib/api';
  import Icon from '@iconify/svelte';
  import Modal from '../../../components/Modal.svelte';

export const ssr = false;

  let roles = $state<string[]>([]);
  userRoles.subscribe(v => { roles = v; if (!userHasPermission(roles, 'manage_roles')) goto('/admin'); });

  let users = $state<{ id: string; email: string; name: string; roles: string[] }[]>([]);
  let loading = $state(true);
  let saving = $state<string | null>(null);

  let allRoleDefs = $state<{ name: string; label: string }[]>([]);
  let editingUserId: string | null = $state(null);
  let selectedRoles = $state<string[]>([]);
  let isDropdownOpen = $state(false);

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
    isDropdownOpen = false;
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
  <a class="back" href="/admin"><Icon icon="mdi:chevron-left" />Admin</a>
  <h1 class="page-title">Users</h1>

  {#if loading}
    <p class="empty">Loading users…</p>
  {:else if users.length === 0}
    <p class="empty">No users yet.</p>
  {:else}
    <div class="group">
      {#each users as u (u.id)}
        <button class="row user" onclick={() => openEditRoles(u)} disabled={saving === u.id}>
          <div class="row-label">
            <div class="email">{u.email}</div>
            <div class="roles">
              {#if u.roles.length}
                {u.roles.map(r => allRoleDefs.find(d => d.name === r)?.label ?? r).join(', ')}
              {:else}
                No roles
              {/if}
            </div>
          </div>
          <Icon icon="mdi:chevron-right" class="chev" />
        </button>
      {/each}
    </div>
  {/if}
</div>

{#if editingUserId}
  <Modal onClose={closeEditRoles}>
    <h2>Roles</h2>
    <p class="sub">{users.find(u => u.id === editingUserId)?.email}</p>
    <div class="group">
      {#each allRoleDefs as def (def.name)}
        <label class="row">
          <span class="row-label">{def.label}</span>
          <input type="checkbox" class="switch" checked={selectedRoles.includes(def.name)} onchange={() => toggleRoleInSelection(def.name)} />
        </label>
      {/each}
    </div>
    <div class="actions">
      <button class="btn btn-secondary" onclick={closeEditRoles}>Cancel</button>
      <button class="btn" onclick={saveRoles} disabled={!!saving}>Save</button>
    </div>
  </Modal>
{/if}

<style>
  .back {
    display: inline-flex;
    align-items: center;
    margin-left: -6px;
  }

  .back :global(svg) { font-size: 22px; }

  .user { width: 100%; text-align: left; color: var(--text); min-height: 56px; }
  .user:active { background: var(--surface-2); }
  .user :global(.chev) { color: var(--text-3); font-size: 20px; }
  .email { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .roles { font-size: var(--text-sm); color: var(--text-2); }
  h2 { margin-bottom: 2px; }
  .sub { color: var(--text-2); font-size: var(--text-sm); margin-bottom: var(--space-4); }
  label.row { cursor: pointer; }
  .actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-5); }
  .actions .btn { min-width: 96px; }
</style>
