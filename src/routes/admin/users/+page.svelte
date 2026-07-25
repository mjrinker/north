<script lang="ts">
  import { userHasPermission } from '../../../lib/featureFlags';
  import { goto } from '$app/navigation';
  import { supabase } from '../../../lib/supabase';
  import { userRoles } from '../../../stores/roles';

  let roles = $state<string[]>([]);
  userRoles.subscribe(v => { roles = v; if (!userHasPermission(roles, 'manage_roles')) goto('/admin'); });

  let users = $state<{ id: string; email: string; name: string; roles: string[] }[]>([]);
  let loading = $state(true);
  let saving = $state<string | null>(null);

  async function loadUsers() {
    loading = true;
    const { data, error } = await supabase.rpc('get_all_users_with_roles');
    if (!error && data) {
      users = data.map((u: any) => ({
        id: u.id,
        email: u.email ?? '',
        name: '',
        roles: u.roles ?? [],
      }));
    } else {
      console.error('loadUsers error:', error?.message);
      users = [];
    }
    loading = false;
  }

  $effect(() => { loadUsers(); });

  async function toggleRole(userId: string, role: string) {
    saving = userId;
    const u = users.find(x => x.id === userId);
    if (!u) return;

    const has = u.roles.includes(role);
    const newRoles = has ? u.roles.filter(r => r !== role) : [...u.roles, role];

    const { error: delErr } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
    if (delErr) { console.error(delErr); saving = null; return; }

    if (newRoles.length > 0) {
      const rows = newRoles.map(role_name => ({ user_id: userId, role_name }));
      const { error: insErr } = await supabase
        .from('user_roles')
        .insert(rows);
      if (insErr) { console.error(insErr); saving = null; return; }
    }

    u.roles = newRoles;
    users = [...users];
    saving = null;
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
          <div class="role-toggles">
            <label class="role-check" class:disabled={saving === u.id}>
              <input
                type="checkbox"
                checked={u.roles.includes('admin')}
                disabled={saving === u.id}
                onchange={() => toggleRole(u.id, 'admin')}
              />
              Admin
            </label>
            <label class="role-check" class:disabled={saving === u.id}>
              <input
                type="checkbox"
                checked={u.roles.includes('beta')}
                disabled={saving === u.id}
                onchange={() => toggleRole(u.id, 'beta')}
              />
              Beta
            </label>
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
  .role-toggles { display: flex; gap: 0.75rem; }
  .role-check {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    color: var(--text-primary, #222);
  }
  .role-check.disabled { opacity: 0.5; pointer-events: none; }
  .role-check input { width: 0.9rem; height: 0.9rem; cursor: pointer; }
</style>
