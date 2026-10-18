<script lang="ts">
  import Icon from '@iconify/svelte';
  import { user } from '../../stores/auth';
  import { userHasPermission } from '../../lib/featureFlags';
  import { goto } from '$app/navigation';

  import { userRoles } from '../../stores/roles';

  let currentUser = $state<any>(null);
  user.subscribe(v => currentUser = v);

  let roles = $state<string[]>([]);
  userRoles.subscribe(v => { roles = v; if (!userHasPermission(roles, 'access_admin')) goto('/'); });
</script>

<div class="page">
  <a class="back" href="/settings"><Icon icon="mdi:chevron-left" />Settings</a>
  <h1 class="page-title">Admin</h1>
  <div class="group">
    <a href="/admin/users" class="row link">
      <div class="row-label"><div class="t">Users</div><div class="s">Assign roles</div></div>
      <Icon icon="mdi:chevron-right" class="chev" />
    </a>
    <a href="/admin/roles" class="row link">
      <div class="row-label"><div class="t">Roles and features</div><div class="s">Which roles get which features and permissions</div></div>
      <Icon icon="mdi:chevron-right" class="chev" />
    </a>
    <a href="/admin/api-keys" class="row link">
      <div class="row-label"><div class="t">API keys</div><div class="s">Create and revoke keys for any user</div></div>
      <Icon icon="mdi:chevron-right" class="chev" />
    </a>
  </div>
</div>

<style>
  .back {
    display: inline-flex;
    align-items: center;
    margin-left: -6px;
  }

  .back :global(svg) { font-size: 22px; }

  .link { color: var(--text); min-height: 60px; }
  .link:active { background: var(--surface-2); }
  .t { font-weight: 500; }
  .s { font-size: var(--text-sm); color: var(--text-2); }
  .link :global(.chev) { color: var(--text-3); font-size: 20px; }
</style>
