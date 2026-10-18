<script lang="ts">
  import '../styles/global.css';
  import { get } from 'svelte/store';
  import { appSettings } from '../lib/settings';
  import { applyThemeEffect } from '../stores/theme';
  import { initRemoteLogger } from '../lib/remoteLogger';
  initRemoteLogger();
  import { user } from '../stores/auth';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import ErrorBoundary from '../components/ErrorBoundary.svelte';
  import Icon from '@iconify/svelte';
  import { iconDataUrl } from '../lib/icon';
  let { children }: { children: any } = $props();
  let currentUser = $state<any>(null);

  user.subscribe(v => currentUser = v);

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

  const tabs = [
    { href: '/today', label: 'Today', icon: 'mdi:checkbox-marked-circle-outline', activeIcon: 'mdi:checkbox-marked-circle' },
    { href: '/history', label: 'History', icon: 'mdi:calendar-blank-outline', activeIcon: 'mdi:calendar-blank' },
    { href: '/stats', label: 'Stats', icon: 'mdi:chart-box-outline', activeIcon: 'mdi:chart-box' },
  ];

  // Account pages (accountability, admin, settings) all live under the last tab.
  let accountActive = $derived(isActive('/settings') || isActive('/accountability') || isActive('/admin') || isActive('/api-docs') || isActive('/tags') || isActive('/identities'));
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href={iconDataUrl(settings.mainColor || '#1c1b1a', settings.accentColor || '#2b62c9')} />
</svelte:head>

<ErrorBoundary>
  <main class="page-content">
    {@render children()}
  </main>
</ErrorBoundary>

<nav class="tabbar" aria-label="Primary">
  {#each tabs as tab}
    {@const active = isActive(tab.href)}
    <a href={tab.href} class="tab" class:active aria-current={active ? 'page' : undefined}>
      <Icon icon={active ? tab.activeIcon : tab.icon} />
      <span>{tab.label}</span>
    </a>
  {/each}
  <a href="/settings" class="tab" class:active={accountActive} aria-current={accountActive ? 'page' : undefined}>
    {#if currentUser?.user_metadata?.avatar_url}
      <img src={currentUser.user_metadata.avatar_url} alt="" class="tab-avatar" referrerpolicy="no-referrer" />
    {:else}
      <Icon icon={accountActive ? 'mdi:cog' : 'mdi:cog-outline'} />
    {/if}
    <span>{currentUser ? 'You' : 'Settings'}</span>
  </a>
</nav>

<style>
  .page-content {
    min-height: 100dvh;
    padding-top: env(safe-area-inset-top);
    padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom) + var(--space-4));
  }

  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border-top: 0.5px solid var(--separator-strong);
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--text-3);
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.01em;
    transition: color 0.15s;
  }

  .tab :global(svg) {
    font-size: 25px;
  }

  .tab.active {
    color: var(--accent);
  }

  .tab-avatar {
    width: 25px;
    height: 25px;
    border-radius: 50%;
    object-fit: cover;
    opacity: 0.85;
  }

  .tab.active .tab-avatar {
    opacity: 1;
    box-shadow: 0 0 0 2px var(--accent);
  }
</style>
