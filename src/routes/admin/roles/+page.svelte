<script lang="ts">
  import Icon from '@iconify/svelte';
  import { user } from '../../../stores/auth';
  import { userHasPermission, type Feature, type Permission } from '../../../lib/featureFlags';
  import { goto } from '$app/navigation';
  import { gql } from '../../../lib/api';
  import { userRoles as userRolesStore } from '../../../stores/roles';

export const ssr = false;

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

  let errorMessage = $state('');

  async function saveRole() {
    if (!editingRole) return;
    errorMessage = '';
    try {
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
    } catch (e: any) {
      errorMessage = e.message ?? 'Failed to save role';
      console.error('saveRole error:', e);
    }
  }

  async function deleteRole(name: string) {
    if (name === 'default' || name === 'admin') return;
    errorMessage = '';
    try {
      roleDefs = roleDefs.filter(r => r.name !== name);
      await persistRoles();
      await loadRoleDefs();
    } catch (e: any) {
      errorMessage = e.message ?? 'Failed to delete role';
      console.error('deleteRole error:', e);
    }
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

  const allFeatures: Feature[] = ['STATS'];
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

<div class="page">
  <a class="back" href="/admin"><Icon icon="mdi:chevron-left" />Admin</a>
  <div class="title-row">
    <h1 class="page-title">Roles</h1>
    {#if !editingRole}<button class="btn btn-sm" onclick={startCreate}><Icon icon="mdi:plus" />New role</button>{/if}
  </div>

  {#if errorMessage}
    <p class="error" role="alert">{errorMessage}</p>
  {/if}

  {#if loading}
    <p class="empty">Loading roles…</p>
  {:else}
    {#if editingRole}
      <section class="editor">
        <h2 class="section-label">{showCreate ? 'New role' : editingRole.label}</h2>
        <div class="fields">
          <div class="field">
            <label for="role-name">Name <span class="hint">used in code, can’t change later</span></label>
            <input id="role-name" type="text" bind:value={editingRole.name} disabled={!showCreate} placeholder="e.g. beta" />
          </div>
          <div class="field">
            <label for="role-label">Label</label>
            <input id="role-label" type="text" bind:value={editingRole.label} placeholder="e.g. Beta tester" />
          </div>
          <div class="field">
            <label for="role-desc">Description</label>
            <textarea id="role-desc" bind:value={editingRole.description} rows="2" placeholder="What this role gets"></textarea>
          </div>
        </div>

        <h3 class="section-label">Features</h3>
        <div class="group">
          {#each allFeatures as feature}
            <label class="row toggle-row">
              <span class="row-label mono">{feature}</span>
              <input type="checkbox" class="switch" checked={editingRole.features.includes(feature)} onchange={() => toggleFeature(editingRole!, feature)} />
            </label>
          {/each}
        </div>

        <h3 class="section-label">Permissions</h3>
        <div class="group">
          {#each allPermissions as perm}
            <label class="row toggle-row">
              <span class="row-label mono">{perm}</span>
              <input type="checkbox" class="switch" checked={editingRole.permissions.includes(perm)} onchange={() => togglePermission(editingRole!, perm)} />
            </label>
          {/each}
        </div>

        <div class="actions">
          <button class="btn btn-secondary" onclick={cancelEdit}>Cancel</button>
          <button class="btn" onclick={saveRole}>Save</button>
        </div>
      </section>
    {/if}

    <div class="group role-list">
      {#each roleDefs as role (role.name)}
        <div class="row role">
          <div class="row-label">
            <div class="role-title">{role.label} <code>{role.name}</code></div>
            {#if role.description}<div class="role-desc">{role.description}</div>{/if}
            <div class="role-meta">
              {role.features.length ? role.features.join(', ') : 'No features'} · {role.permissions.length ? role.permissions.join(', ') : 'no permissions'}
            </div>
          </div>
          <button class="btn btn-sm btn-secondary" onclick={() => startEdit(role)}>Edit</button>
          {#if role.name !== 'default' && role.name !== 'admin'}
            <button class="icon-btn" onclick={() => deleteRole(role.name)} aria-label="Delete {role.label}"><Icon icon="mdi:trash-can-outline" /></button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .back {
    display: inline-flex;
    align-items: center;
    margin-left: -6px;
  }

  .back :global(svg) { font-size: 22px; }

  .title-row { display: flex; align-items: center; justify-content: space-between; }
  .error { padding: var(--space-3); border-radius: var(--radius); background: var(--danger-soft); color: var(--danger); font-size: var(--text-sm); margin-bottom: var(--space-3); }
  .editor { margin-bottom: var(--space-6); }
  .editor > .section-label:first-child { margin-top: 0; }
  .fields { display: flex; flex-direction: column; gap: var(--space-3); }
  .hint { font-weight: 400; color: var(--text-3); }
  .toggle-row { cursor: pointer; }
  .mono, code { font-family: var(--font-mono); font-size: var(--text-sm); }
  code { color: var(--text-3); font-weight: 400; }
  .actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  .actions .btn { min-width: 96px; }
  .role { align-items: flex-start; padding-top: var(--space-3); padding-bottom: var(--space-3); }
  .role-title { font-weight: 500; }
  .role-desc { font-size: var(--text-sm); color: var(--text-2); }
  .role-meta { font-size: var(--text-xs); color: var(--text-3); margin-top: 2px; font-family: var(--font-mono); }
  .icon-btn { color: var(--text-3); font-size: 20px; }
</style>
