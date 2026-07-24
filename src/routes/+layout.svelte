<script lang="ts">
  import '../styles/global.css';
  import { get } from 'svelte/store';
  import { appSettings, type LaunchScreen } from '../lib/settings';
  import { applyThemeEffect } from '../stores/theme';
  import { initRemoteLogger } from '../lib/remoteLogger';
  initRemoteLogger();
  import { user, signInWithGoogle, signOut } from '../stores/auth';
  import { userRoles } from '../stores/roles';
  import { userHasFeature, userHasPermission } from '../lib/featureFlags';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getSchema, toggleSchema } from '../lib/schemaToggle';
  import ErrorBoundary from '../components/ErrorBoundary.svelte';
  let { children }: { children: any } = $props();
  let currentUser = $state<any>(null);

  console.log('[layout] script start, path:', typeof window !== 'undefined' ? window.location.href : 'SSR');
  user.subscribe(v => {
    currentUser = v;
    console.log('[layout] user:', v ? v.id?.slice(0,8) : 'null');
  });
  let roles = $state<string[]>([]);
  userRoles.subscribe(v => {
    roles = v;
    console.log('[layout] roles:', v);
  });

  let settings = $state(get(appSettings));

  $effect(() => {
    const unsub = appSettings.subscribe(v => {
      settings = v;
      console.log('[layout] settings loaded');
    });
    return unsub;
  });

  $effect(() => {
    console.log('[layout] $effect: init');
    appSettings.init();
    const unsub = applyThemeEffect();
    return () => { console.log('[layout] $effect: cleanup'); unsub(); };
  });

  let currentPath = $state('');
  page.subscribe(p => {
    currentPath = p.url.pathname;
    console.log('[layout] page:', p.url.pathname);
  });

  let launched = $state(false);
  $effect(() => {
    if (!launched && currentPath && settings.launchScreen && currentPath !== settings.launchScreen) {
      console.log('[layout] launch redirect to', settings.launchScreen);
      if (currentPath === '/') {
        launched = true;
        goto(settings.launchScreen, { replaceState: true });
      }
    }
  });

  $effect(() => { console.log('[layout] mounted'); });

  let schemaVersion = $state(getSchema());
  function handleSchemaToggle() {
    toggleSchema();
    schemaVersion = getSchema();
    console.log('[layout] schema toggled to', schemaVersion);
  }
</script>

<nav>
  <a href="/today">Today</a>
  <a href="/history">History</a>
  {#if userHasFeature(roles, 'stats')}<a href="/stats">Stats</a>{/if}
  {#if userHasPermission(roles, 'access_admin')}<a href="/admin">Admin</a>{/if}
  <a href="/settings">Settings</a>
  <div class="spacer"></div>
  <a href="/debug" class="debug-link">Debug</a>
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

<button class="schema-toggle" onclick={handleSchemaToggle} title="Toggle DB schema (old user_sync_data vs new typed tables)">
  {schemaVersion === 'new' ? 'NEW' : 'OLD'}
</button>

<ErrorBoundary>
  {@render children()}
</ErrorBoundary>

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
  .schema-toggle {
    position: fixed;
    bottom: 1.5rem;
    left: 1.5rem;
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 50%;
    background: var(--schema-toggle-bg, #6b7280);
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    z-index: 50;
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1;
  }
  .schema-toggle:hover { opacity: 0.9; }
  .debug-link {
    color: var(--accent, #6366f1);
    font-weight: 600;
  }
</style>
