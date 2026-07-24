<script lang="ts">
  console.log('[admin] script start');
  import { user } from '../../stores/auth';
  import { userHasPermission } from '../../lib/featureFlags';
  import { goto } from '$app/navigation';

  import { userRoles } from '../../stores/roles';

  let currentUser = $state<any>(null);
  user.subscribe(v => { currentUser = v; console.log('[admin] user:', v ? v.id?.slice(0,8) : 'null'); });

  let roles = $state<string[]>([]);
  userRoles.subscribe(v => { roles = v; console.log('[admin] roles:', v); if (!userHasPermission(roles, 'access_admin')) goto('/'); });
  console.log('[admin] script body done');
</script>

<div class="admin-page">
  <h1>Admin Console</h1>
  <p class="subtitle">Welcome{currentUser ? ', ' + (currentUser.user_metadata?.name ?? currentUser.email) : ''}</p>

  <div class="card-grid">
    <a href="/admin/users" class="card">
      <h2>Users</h2>
      <p>Manage user roles and permissions</p>
    </a>
  </div>
</div>

<style>
  .admin-page {
    padding: 1.5rem;
    max-width: 700px;
    margin: 0 auto;
  }
  h1 { color: var(--text-primary, #222); margin-bottom: 0.25rem; }
  .subtitle { color: var(--text-secondary, #666); margin-bottom: 1.5rem; }
  .card-grid { display: grid; gap: 1rem; }
  .card {
    display: block;
    padding: 1.25rem;
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition: box-shadow 0.15s;
  }
  .card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .card h2 { margin: 0 0 0.25rem; font-size: 1.1rem; color: var(--text-primary, #222); }
  .card p { margin: 0; font-size: 0.85rem; color: var(--text-secondary, #666); }
</style>
