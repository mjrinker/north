<script lang="ts">
  import '../styles/global.css';
  import { theme } from '../stores/theme';
  import { user, signInWithGoogle, signOut } from '../stores/auth';
  import { userRoles } from '../stores/roles';
  import { userHasFeature, userHasPermission } from '../lib/featureFlags';
  let { children }: { children: any } = $props();
  let currentTheme = $state<'light' | 'dark' | 'system'>('system');
  theme.subscribe(v => currentTheme = v);
  let currentUser = $state<any>(null);
  user.subscribe(v => currentUser = v);
  let roles = $state<string[]>([]);
  userRoles.subscribe(v => roles = v);
</script>

<nav>
  <a href="/">Today</a>
  <a href="/habits">History</a>
  {#if userHasFeature(roles, 'stats')}<a href="/stats">Stats</a>{/if}
  {#if userHasPermission(roles, 'access_admin')}<a href="/admin">Admin</a>{/if}
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
  <div class="theme-slider">
    <button type="button" class:active={currentTheme === 'system'} onclick={() => theme.set('system')} aria-label="System theme">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.936c.04.178.06.364.06.564 0 .2-.02.386-.06.564l1.53 1.188a.75.75 0 01.21.942l-1.44 2.496a.75.75 0 01-.768.372l-1.896-.288a5.25 5.25 0 01-.924.54l-.396 1.86a.75.75 0 01-.738.606H9.486a.75.75 0 01-.738-.606l-.396-1.86a5.25 5.25 0 01-.924-.54l-1.896.288a.75.75 0 01-.768-.372l-1.44-2.496a.75.75 0 01.21-.942L4.872 12.12a.776.776 0 010-1.128L3.342 9.804a.75.75 0 01-.21-.942l1.44-2.496a.75.75 0 01.768-.372l1.896.288a5.25 5.25 0 01.924-.54l.396-1.86a.75.75 0 01.738-.606h5.028a.75.75 0 01.738.606l.396 1.86a5.25 5.25 0 01.924.54l1.896-.288a.75.75 0 01.768.372l1.44 2.496a.75.75 0 01-.21.942l-1.53 1.188ZM12 9a3 3 0 100 6 3 3 0 000-6Z"/></svg>
    </button>
    <button type="button" class:active={currentTheme === 'light'} onclick={() => theme.set('light')} aria-label="Light theme">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2m-6.5-6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0ZM6.34 17.66l-1.41 1.41M17.66 6.34l1.41-1.41"/></svg>
    </button>
    <button type="button" class:active={currentTheme === 'dark'} onclick={() => theme.set('dark')} aria-label="Dark theme">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.752 15.002A9.718 9.718 0 0112 21.752 9.75 9.75 0 013.48 3.48A9.75 9.75 0 0121.752 15c-.75 2.25-2.25 4.5-5.752 4.5 0 0 0 0 0 0z"/></svg>
    </button>
  </div>
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
    color: var(--accent, #0066cc);
    font-weight: 500;
    font-size: 0.9rem;
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
    background: var(--accent, #0066cc);
    color: white;
    border-color: var(--accent, #0066cc);
  }
  .theme-slider {
    display: flex;
    background: var(--slide-track, #e0e0e0);
    border-radius: 999px;
    padding: 3px;
    gap: 2px;
  }
  .theme-slider button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    border: none;
    border-radius: 999px;
    background: transparent;
    cursor: pointer;
    color: var(--text-secondary, #555);
    transition: background 0.2s, color 0.2s;
  }
  .theme-slider button svg { width: 18px; height: 18px; }
  .theme-slider button.active {
    background: var(--slide-thumb, #fff);
    color: var(--accent, #0066cc);
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }
  .theme-slider button:hover:not(.active) { background: rgba(0,0,0,0.05); }
</style>
