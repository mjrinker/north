<script lang="ts">
  import '../styles/global.css';
  import { get } from 'svelte/store';
  import { appSettings, type LaunchScreen } from '../lib/settings';
  import { applyThemeEffect } from '../stores/theme';
  import { initRemoteLogger } from '../lib/remoteLogger';
  initRemoteLogger();
  import { user, signOut } from '../stores/auth';
  import { userRoles } from '../stores/roles';
  import { userHasPermission } from '../lib/featureFlags';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { showCreateHabit } from '../stores/createHabit';
  import ErrorBoundary from '../components/ErrorBoundary.svelte';
  import LogoutConfirmModal from '../components/LogoutConfirmModal.svelte';
  import IOSNativeStyles from '../components/IOSNativeStyles.svelte';
  import Icon from '@iconify/svelte';
  import { iconDataUrl } from '../lib/icon';
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

  function isActive(path: string) {
    return currentPath === path || currentPath.startsWith(path + '/');
  }

  function handleCreateHabit() {
    showCreateHabit.update(n => n + 1);
  }

  let showAvatarMenu = $state(false);
  let avatarMenuEl = $state<HTMLDivElement | null>(null);

  function toggleAvatarMenu() {
    showAvatarMenu = !showAvatarMenu;
  }

  let showLogoutConfirm = $state(false);

  function handleLogout() {
    showAvatarMenu = false;
    showLogoutConfirm = true;
  }

  function handleSwitchUser() {
    showAvatarMenu = false;
    signOut();
  }

  function handleAvatarKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleAvatarMenu();
    }
  }

  function handleMenuKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      showAvatarMenu = false;
    }
  }

  function handleOutsideClick(e: MouseEvent) {
    if (avatarMenuEl && !avatarMenuEl.contains(e.target as Node)) {
      showAvatarMenu = false;
    }
  }

  $effect(() => {
    if (showAvatarMenu) {
      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
    }
  });
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href={iconDataUrl(settings.mainColor || '#1a1a2e', settings.accentColor || '#0066cc')} />
</svelte:head>

<svelte:window on:keydown={handleMenuKeydown} />

<IOSNativeStyles />
<ErrorBoundary>
  <div class="page-content">
    {@render children()}
  </div>
</ErrorBoundary>

<nav class="bottom-bar">
  <a href="/today" class="bar-link" class:active={isActive('/today')} aria-label="Today">
    <Icon icon="mdi:calendar-check" />
  </a>
  <a href="/history" class="bar-link" class:active={isActive('/history')} aria-label="History">
    <Icon icon="mdi:history" />
  </a>

  <button class="fab" onclick={handleCreateHabit} aria-label="Add Habit">
    <Icon icon="mdi:plus" />
  </button>

  <a href="/stats" class="bar-link" class:active={isActive('/stats')} aria-label="Stats">
    <Icon icon="mdi:chart-bar" />
  </a>
  <div class="avatar-wrap" bind:this={avatarMenuEl}>
    {#if currentUser}
      <button class="bar-link avatar-btn" onclick={toggleAvatarMenu} onkeydown={handleAvatarKeydown} aria-label="Account" aria-expanded={showAvatarMenu}>
        {#if currentUser.user_metadata?.avatar_url}
          <img src={currentUser.user_metadata.avatar_url} alt="" class="bar-avatar" />
        {:else}
          <Icon icon="mdi:account-circle" />
        {/if}
      </button>
      {#if showAvatarMenu}
        <div class="avatar-menu" role="menu">
          <a href="/accountability" class="menu-item" role="menuitem" onclick={() => showAvatarMenu = false}>
            <Icon icon="mdi:account-heart" />
            Accountability
          </a>
          {#if userHasPermission(roles, 'access_admin')}
            <a href="/admin" class="menu-item" role="menuitem" onclick={() => showAvatarMenu = false}>
              <Icon icon="mdi:shield-account" />
              Admin
            </a>
          {/if}
          <a href="/settings" class="menu-item" role="menuitem" onclick={() => showAvatarMenu = false}>
            <Icon icon="mdi:cog" />
            Settings
          </a>
          <button class="menu-item" role="menuitem" onclick={handleSwitchUser}>
            <Icon icon="mdi:account-switch" />
            Switch User
          </button>
          <button class="menu-item menu-item--danger" role="menuitem" onclick={handleLogout}>
            <Icon icon="mdi:logout" />
            Logout
          </button>
        </div>
      {/if}
    {:else}
      <a href="/settings" class="bar-link" class:active={isActive('/settings')} aria-label="Settings">
        <Icon icon="mdi:cog" />
      </a>
    {/if}
  </div>
</nav>

{#if showLogoutConfirm}
  <LogoutConfirmModal onClose={() => showLogoutConfirm = false} />
{/if}

<style>
  .page-content {
    padding-bottom: 5.5rem;
    min-height: 100dvh;
    box-sizing: border-box;
  }

  .bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4.25rem;
    display: flex;
    align-items: center;
    justify-content: space-evenly;
    background: var(--nav-bg, #f5f5f5);
    border-top: 1px solid var(--nav-border, #e0e0e0);
    z-index: 40;
    padding: 0 0.25rem;
    box-sizing: border-box;
  }

  .bar-link {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    color: var(--text-secondary, #888);
    padding: 0.25rem;
    border-radius: 0;
    transition: color 0.15s;
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
    line-height: 1;
  }

  .bar-link :global(svg), .bar-link :global(.iconify) {
    font-size: 1.6rem;
  }

  .bar-link.active {
    color: var(--accent, #0066cc);
  }

  .bar-link:hover {
    color: var(--text-primary, #222);
  }

  .fab {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 50%;
    background: var(--accent, #0066cc);
    color: var(--accent-text, white);
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
    font-size: 2rem;
  }

  .fab:hover {
    opacity: 0.9;
  }

  .avatar-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .avatar-btn {
    padding: 0;
  }

  .bar-avatar {
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    object-fit: cover;
  }

  .avatar-menu {
    position: absolute;
    bottom: calc(100% + 0.5rem);
    right: 0;
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    min-width: 180px;
    padding: 0.25rem 0;
    z-index: 100;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: none;
    background: none;
    font-size: 0.9rem;
    font-family: inherit;
    color: var(--text-primary, #222);
    cursor: pointer;
    text-decoration: none;
    box-sizing: border-box;
    line-height: 1;
  }

  .menu-item :global(svg), .menu-item :global(.iconify) {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .menu-item:hover {
    background: var(--btn-secondary-bg, #eee);
  }

  .menu-item--danger {
    color: #d32f2f;
  }

</style>
