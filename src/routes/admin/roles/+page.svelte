<script lang="ts">
  import { user } from '../../../stores/auth';
  import { userHasPermission, type Feature, type Permission } from '../../../lib/featureFlags';
  import { goto } from '$app/navigation';
  import { gql } from '../../../lib/api';
  import { userRoles as userRolesStore } from '../../../stores/roles';

  let currentUser = $state<any>(null);
  user.subscribe(v => currentUser = v);

  let roles = $state<string[]>([]);
  userRolesStore.subscribe(v => { roles = v; if (!userHasPermission(roles, 'manage_roles')) goto('/'); });

  let roleDefs = $state<any[]>([]);
  let editingRole: any | null = $state(null);
  let showCreate = $state(false);
  let loading = $state(true);

  async function loadRoleDefs() {
    loading = true;
    try {
      const data = await gql<{ roleDefs: any[] }>(`query { roleDefs { name label description features permissions createdAt updatedAt } }`);
      roleDefs = data?.roleDefs ?? [];
    } catch (e) {
      console.error('loadRoleDefs error:', e);
      roleDefs = [];
    }
    loading = false;
  }

  $effect(() => { loadRoleDefs(); });

  async function saveRole() {
    if (!editingRole) return;
    const idx = roleDefs.findIndex(r => r.name === editingRole.name);
    if (idx >= 0) {
      roleDefs[idx] = { ...editingRole, updatedAt: new Date().toISOString() };
    } else {
      roleDefs.push({ ...editingRole, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    await persistRoles();
    editingRole = null;
    showCreate = false;
    await loadRoleDefs();
  }

  async function deleteRole(name: string) {
    if (name === 'default' || name === 'admin') return;
    roleDefs = roleDefs.filter(r => r.name !== name);
    await persistRoles();
    await loadRoleDefs();
  }

  async function persistRoles() {
    await gql<{ setRoleDefs: boolean }>(
      `mutation ($defs: JSON!) { setRoleDefs(defs: $defs) }`,
      { defs: roleDefs }
    );
  }

  function startEdit(role: any) {
    editingRole = { ...role };
  }

  function startCreate() {
    editingRole = {
      name: '',
      label: '',
      description: '',
      features: [],
      permissions: [],
    };
    showCreate = true;
  }

  function cancelEdit() {
    editingRole = null;
    showCreate = false;
  }

  const allFeatures: Feature[] = ['stats', 'sync', 'beta'];
  const allPermissions: Permission[] = ['access_admin', 'manage_roles'];

  function toggleFeature(role: any, feature: Feature) {
    const idx = role.features.indexOf(feature);
    if (idx >= 0) role.features.splice(idx, 1);
    else role.features.push(feature);
  }

  function togglePermission(role: any, perm: Permission) {
    const idx = role.permissions.indexOf(perm);
    if (idx >= 0) role.permissions.splice(idx, 1);
    else role.permissions.push(perm);
  }
</script>

<div class="admin-page">
  <h1>Roles & Features</h1>
  <p class="subtitle">Define roles and assign features/permissions. Features are defined in code.</p>

  {#if loading}
    <p class="status">Loading roles...</p>
  {:else}

  <div class="actions">
    <button class="btn" onclick={startCreate}>Create Role</button>
  </div>

  {#if editingRole}
    <div class="role-form card">
      <h2>{showCreate ? 'Create Role' : 'Edit ' + editingRole.label}</h2>
      <div class="form-group">
        <label>Name (unique, code reference)</label>
        <input type="text" bind:value={editingRole.name} disabled={!showCreate} placeholder="e.g. premium" />
        <small>Cannot be changed after creation</small>
      </div>
      <div class="form-group">
        <label>Label</label>
        <input type="text" bind:value={editingRole.label} placeholder="e.g. Premium User" />
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea bind:value={editingRole.description} rows="2" placeholder="What this role provides"></textarea>
      </div>

      <div class="form-group">
        <label>Features</label>
        <div class="checkbox-grid">
          {#each allFeatures as feature}
            <label class="checkbox-item">
              <input type="checkbox" checked={editingRole.features.includes(feature)} onchange={() => toggleFeature(editingRole!, feature)} />
              <span>{feature}</span>
            </label>
          {/each}
        </div>
      </div>

      <div class="form-group">
        <label>Permissions</label>
        <div class="checkbox-grid">
          {#each allPermissions as perm}
            <label class="checkbox-item">
              <input type="checkbox" checked={editingRole.permissions.includes(perm)} onchange={() => togglePermission(editingRole!, perm)} />
              <span>{perm}</span>
            </label>
          {/each}
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" onclick={cancelEdit}>Cancel</button>
        <button class="btn" onclick={saveRole}>Save</button>
      </div>
    </div>
  {/if}

  <div class="role-list">
    {#each roleDefs as role (role.name)}
      <div class="role-card card">
        <div class="role-header">
          <div>
            <h3>{role.label} <code>{role.name}</code></h3>
            <p>{role.description}</p>
          </div>
          <div class="role-actions">
            <button class="btn btn-small" onclick={() => startEdit(role)}>Edit</button>
            {#if role.name !== 'default' && role.name !== 'admin'}
              <button class="btn btn-small btn-danger" onclick={() => deleteRole(role.name)}>Delete</button>
            {/if}
          </div>
        </div>
        <div class="role-meta">
          <div class="meta-group">
            <strong>Features:</strong>
            <span>{role.features.length ? role.features.join(', ') : '—'}</span>
          </div>
          <div class="meta-group">
            <strong>Permissions:</strong>
            <span>{role.permissions.length ? role.permissions.join(', ') : '—'}</span>
</div>
      </div>
    </div>
  {/each}
</div>
{/if}
</div>

<style>
  .admin-page {
    padding: 1.5rem;
    max-width: 800px;
    margin: 0 auto;
  }
  h1 { color: var(--text-primary, #222); margin-bottom: 0.25rem; }
  .subtitle { color: var(--text-secondary, #666); margin-bottom: 1.5rem; }
  .actions { margin-bottom: 1.5rem; }
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .btn-secondary { background: var(--btn-secondary-bg, #eee); color: var(--text-primary, #222); }
  .btn-danger { background: #fee2e2; color: #dc2626; }
  .btn-small { padding: 0.35rem 0.75rem; font-size: 0.8rem; }
  .card {
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 10px;
    padding: 1.25rem;
    margin-bottom: 1rem;
  }
  .form-group { margin-bottom: 1rem; }
  .form-group label { display: block; font-weight: 500; margin-bottom: 0.35rem; color: var(--text-primary, #222); }
  .form-group input, .form-group textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    font-size: 0.9rem;
    box-sizing: border-box;
  }
  .form-group small { display: block; margin-top: 0.25rem; font-size: 0.75rem; color: var(--text-secondary, #888); }
  .checkbox-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.5rem;
  }
  .checkbox-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .form-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }
  .role-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .role-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }
  .role-header h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
  }
  .role-header code {
    font-size: 0.75rem;
    background: var(--btn-secondary-bg, #eee);
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
  }
  .role-header p { margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--text-secondary, #666); }
  .role-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
  .role-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    font-size: 0.85rem;
    color: var(--text-secondary, #666);
  }
  .meta-group { display: flex; flex-direction: column; gap: 0.25rem; }
  .meta-group strong { color: var(--text-primary, #222); font-size: 0.8rem; }
</style>