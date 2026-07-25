<script lang="ts">
  import '../styles/global.css';
  import { get } from 'svelte/store';
  import { appSettings, type LaunchScreen } from '../lib/settings';
  import { applyThemeEffect } from '../stores/theme';
  import { initRemoteLogger } from '../lib/remoteLogger';
  initRemoteLogger();
  import { user, signInWithGoogle } from '../stores/auth';
  import { userRoles } from '../stores/roles';
  import { userHasFeature, userHasPermission } from '../lib/featureFlags';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getSchema, toggleSchema } from '../lib/schemaToggle';
  import { showCreateHabit } from '../stores/createHabit';
  import ErrorBoundary from '../components/ErrorBoundary.svelte';
  import Icon from '@iconify/svelte';
  let { children }: { children: any } = $props();
  let currentUser = $state<any>(null);

  user.subscribe(v => currentUser = v);
  let roles = $state<string[]>([]);
  userRoles.subscribe(v => roles = v);

  let settings = $state(get(appSettings));

  $effect(() => {
    const unsub = appSettings.subscribe(v => settings = v);
    return unsub;
  });

  $effect(() => {
    appSettings.init();
    return applyThemeEffect();
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

  let schemaVersion = $state(getSchema());
  function handleSchemaToggle() {
    toggleSchema();
    schemaVersion = getSchema();
  }

  function isActive(path: string) {
    return currentPath === path || currentPath.startsWith(path + '/');
  }

  function handleCreateHabit() {
    showCreateHabit.update(n => n + 1);
  }
</script>

<ErrorBoundary>
  <div class="page-content">
    {@render children()}
  </div>
</ErrorBoundary>

<nav class="bottom-bar">
  <div class="bar-item" class:active={isActive('/today')}>
    <a href="/today" class="bar-link">
      <Icon icon="mdi:calendar-check" />
      <span class="bar-label">Today</span>
    </a>
  </div>
  <div class="bar-item" class:active={isActive('/history')}>
    <a href="/history" class="bar-link">
      <Icon icon="mdi:history" />
      <span class="bar-label">History</span>
    </a>
  </div>
  {#if userHasFeature(roles, 'stats')}
    <div class="bar-item" class:active={isActive('/stats')}>
      <a href="/stats" class="bar-link">
        <Icon icon="mdi:chart-bar" />
        <span class="bar-label">Stats</span>
      </a>
    </div>
  {/if}
  {#if userHasPermission(roles, 'access_admin')}
    <div class="bar-item" class:active={isActive('/admin')}>
      <a href="/admin" class="bar-link">
        <Icon icon="mdi:shield-account" />
        <span class="bar-label">Admin</span>
      </a>
    </div>
  {/if}

  <div class="bar-fab-spacer"></div>

  <button class="fab" onclick={handleCreateHabit} aria-label="Add Habit">
    <Icon icon="mdi:plus" />
  </button>

  <div class="bar-fab-spacer"></div>

  <div class="bar-item bar-item--right" class:active={isActive('/settings')}>
    <a href="/settings" class="bar-link">
      <Icon icon="mdi:cog" />
      <span class="bar-label">Settings</span>
    </a>
  </div>
  <div class="bar-item bar-item--right">
    {#if currentUser}
      {#if currentUser.user_metadata?.avatar_url}
        <a href="/settings" class="bar-link">
          <img src={currentUser.user_metadata.avatar_url} alt="" class="bar-avatar" />
        </a>
      {:else}
        <a href="/settings" class="bar-link">
          <Icon icon="mdi:account-circle" />
        </a>
      {/if}
    {:else}
      <button class="bar-link bar-auth" onclick={signInWithGoogle} aria-label="Sign in">
        <Icon icon="mdi:login" />
      </button>
    {/if}
  </div>
</nav>

<button class="schema-toggle" onclick={handleSchemaToggle} title="Toggle DB schema (old user_sync_data vs new typed tables)">
  {schemaVersion === 'new' ? 'NEW' : 'OLD'}
</button>

<style>
  .page-content {
    padding-bottom: 5rem;
    min-height: 100dvh;
    box-sizing: border-box;
  }

  .bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--nav-bg, #f5f5f5);
    border-top: 1px solid var(--nav-border, #e0e0e0);
    z-index: 40;
    padding: 0 0.25rem;
    box-sizing: border-box;
  }

  .bar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  .bar-link {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    text-decoration: none;
    color: var(--text-secondary, #888);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: color 0.15s;
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
    line-height: 1;
  }

  .bar-link :global(svg), .bar-link :global(.iconify) {
    font-size: 1.35rem;
  }

  .bar-label {
    font-size: 0.6rem;
    font-weight: 500;
  }

  .bar-item.active .bar-link {
    color: var(--accent, #0066cc);
  }

  .bar-link:hover {
    color: var(--text-primary, #222);
  }

  .bar-fab-spacer {
    flex: 1;
    min-width: 0.5rem;
  }

  .fab {
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 50%;
    background: var(--accent, #0066cc);
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    z-index: 51;
    position: relative;
    top: -0.75rem;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }

  .fab :global(svg), .fab :global(.iconify) {
    font-size: 1.75rem;
  }

  .fab:hover {
    opacity: 0.9;
  }

  .bar-avatar {
    width: 1.35rem;
    height: 1.35rem;
    border-radius: 50%;
    object-fit: cover;
  }

  .schema-toggle {
    position: fixed;
    top: 0.5rem;
    left: 0.5rem;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background: var(--schema-toggle-bg, #6b7280);
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 50;
    font-size: 0.65rem;
    font-weight: 700;
    line-height: 1;
    opacity: 0.6;
  }

  .schema-toggle:hover {
    opacity: 1;
  }
</style>
