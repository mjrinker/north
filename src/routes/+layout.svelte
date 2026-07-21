<script lang="ts">
  import '../styles/global.css';
  import { appSettings, type LaunchScreen } from '../lib/settings';
  import { applyThemeEffect } from '../stores/theme';
  import { user, signInWithGoogle, signOut } from '../stores/auth';
  import { userRoles } from '../stores/roles';
  import { userHasFeature, userHasPermission } from '../lib/featureFlags';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  let { children }: { children: any } = $props();
  let currentUser = $state<any>(null);
  user.subscribe(v => currentUser = v);
  let roles = $state<string[]>([]);
  userRoles.subscribe(v => roles = v);
  let settings = $state(appSettings);

  $effect(() => {
    const unsub = appSettings.subscribe(v => settings = v);
    return unsub;
  });

  $effect(() => {
    appSettings.init();
    const unsub = applyThemeEffect();
    return unsub;
  });

  let currentPath = $state('');
  page.subscribe(p => currentPath = p.url.pathname);

  let launched = $state(false);
  $effect(() => {
    if (!launched && currentPath && settings.launchScreen && currentPath !== settings.launchScreen) {
      if (currentPath === '/') {
        launched = true;
        goto(settings.launchScreen, { replaceState: true });
      }
    }
  });
</script>

<nav>
  <a href="/today" onclick={(e) => { e.preventDefault(); goto('/today'); }}>Today</a>
  <a href="/history" onclick={(e) => { e.preventDefault(); goto('/history'); }}>History</a>
  {#if userHasFeature(roles, 'stats')}<a href="/stats" onclick={(e) => { e.preventDefault(); goto('/stats'); }}>Stats</a>{/if}
  {#if userHasPermission(roles, 'access_admin')}<a href="/admin" onclick={(e) => { e.preventDefault(); goto('/admin'); }}>Admin</a>{/if}
  <a href="/settings" onclick={(e) => { e.preventDefault(); goto('/settings'); }}>Settings</a>
  <div class="spacer"></div>
  {#if currentUser}
    {#if currentUser.user_metadata?.avatar_url}
      <img src={currentUser.user_metadata.avatar_url} alt="" class="avatar" />
    {/if}
    <span class="user-name">{currentUser.user_metadata?.name ?? currentUser.email}</span>
    <button class="auth-btn" onclick={signOut}>Logout</button>
  {:else}
    <button class="auth-btn" onclick={signInWithGoogle}>Sign in with Google</button>
  {/if}
</nav>

{@render children()}

<style>
  nav {
    display: flex;
    align-items: center;
    padding: 0.5rem 1rem;
    background: var(--nav-bg, #f5f5f5);
    border-bottom: 1px solid var(--nav-border, #e0e0e0);
    gap: 0.5rem;
  }
  nav a {
    text-decoration: none;
    color: var(--text-primary, #222);
    font-weight: 500;
    font-size: 0.9rem;
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
  }
  nav a:hover {
    background: var(--btn-secondary-bg, #eee);
  }
  .spacer { flex: 1; }
  .avatar { width: 24px; height: 24px; border-radius: 50%; }
  .user-name { font-size: 0.85rem; color: var(--text-primary, #222); }
  .auth-btn {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--text-primary, #222);
  }
  .auth-btn:hover {
    background: var(--bg);
    border-color: var(--text-secondary, #555);
  }
</style>
