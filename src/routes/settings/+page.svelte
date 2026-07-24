<script lang="ts">
  console.log('[settings] script start');
  import { user, signInWithGoogle, signOut } from '../../stores/auth'
  import { supabaseSyncProvider } from '../../services/sync.providers/supabase'
  import { get } from 'svelte/store'
  import { appSettings, updateSettings, type AppSettings, type ThemeMode, type LaunchScreen } from '../../lib/settings'

  let currentUser = $state<any>(null)
  let syncing = $state(false)
  let syncStatus = $state('')
  let lastSynced = $state<string | null>(null)

  let s = $state<AppSettings>(get(appSettings))

  $effect(() => {
    const unsub = appSettings.subscribe(v => {
      s = v;
      console.log('[settings] settings updated');
    });
    return unsub;
  })

  function update(partial: Partial<AppSettings>) {
    updateSettings(partial)
  }

  user.subscribe(async (u) => {
    currentUser = u;
    console.log('[settings] user:', u ? u.id?.slice(0,8) : 'null');
  })

  console.log('[settings] script body done');

  async function syncNow() {
    if (!currentUser) return
    syncing = true
    syncStatus = 'Downloading…'
    try {
      await supabaseSyncProvider.downloadAll()
      syncStatus = 'Uploading…'
      const result = await supabaseSyncProvider.uploadAll()
      syncStatus = result.status === 'success' ? 'Synced successfully' : `Sync error: ${result.status}`
      lastSynced = new Date().toLocaleTimeString()
    } catch (e: any) {
      syncStatus = `Sync failed: ${e.message}`
    }
    syncing = false
  }
</script>

<div class="page">
  <h1>Settings</h1>

  <section class="card">
    <h2>Reset Time</h2>
    <p>When should habits reset for the next day?</p>
    <input type="time" value={s.resetTime} oninput={(e) => update({ resetTime: (e.target as HTMLInputElement).value })} />
  </section>

  <section class="card">
    <h2>Appearance</h2>
    <div class="setting-row">
      <span class="setting-label">Theme</span>
      <select value={s.themeMode} onchange={(e) => update({ themeMode: (e.target as HTMLSelectElement).value as ThemeMode })}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="adaptive">Adaptive (time of day)</option>
      </select>
    </div>
    <div class="setting-row">
      <span class="setting-label">OLED mode (true black)</span>
      <label class="toggle">
        <input type="checkbox" checked={s.oled} onchange={(e) => update({ oled: (e.target as HTMLInputElement).checked })} />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="setting-row">
      <span class="setting-label">Accent color</span>
      <input type="color" value={s.accentColor || '#0066cc'} oninput={(e) => update({ accentColor: (e.target as HTMLInputElement).value })} class="color-picker" />
    </div>
    <div class="setting-row">
      <span class="setting-label">Main color</span>
      <div class="color-row">
        <input type="color" value={s.mainColor || '#1a1a2e'} oninput={(e) => update({ mainColor: (e.target as HTMLInputElement).value })} class="color-picker" />
        {#if s.mainColor}
          <button class="btn-reset" onclick={() => update({ mainColor: '' })}>Reset</button>
        {/if}
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Launch Screen</h2>
    <p>Which page opens by default?</p>
    <select value={s.launchScreen} onchange={(e) => update({ launchScreen: (e.target as HTMLSelectElement).value as LaunchScreen })}>
      <option value="/today">Today</option>
      <option value="/history">History</option>
      <option value="/stats">Stats</option>
      <option value="/settings">Settings</option>
    </select>
  </section>

  <section class="card">
    <h2>Account</h2>
    {#if currentUser}
      <p class="user-info">
        Signed in as <strong>{currentUser.email}</strong>
      </p>
      <button class="btn" onclick={signOut}>Sign Out</button>
    {:else}
      <p>Sign in to enable cloud sync.</p>
      <button class="btn" onclick={signInWithGoogle}>Sign in with Google</button>
    {/if}
  </section>

  <section class="card">
    <h2>Cloud Sync</h2>
    <p>Sync your habits, entries, and identities to Supabase for backup.</p>
    {#if currentUser}
      <button class="btn" onclick={syncNow} disabled={syncing}>
        {syncing ? 'Syncing…' : 'Sync Now'}
      </button>
      {#if syncStatus}
        <p class="status">{syncStatus}</p>
      {/if}
      {#if lastSynced}
        <p class="muted">Last synced: {lastSynced}</p>
      {/if}
    {:else}
      <p class="muted">Sign in above to enable cloud sync.</p>
    {/if}
  </section>
</div>

<style>
  .page {
    padding: 1.5rem;
    max-width: 600px;
    margin: 0 auto;
  }
  h1 { color: var(--text-primary, #222); margin-bottom: 1rem; }
  .card {
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e0e0e0);
    border-radius: 10px;
    padding: 1.25rem;
    margin-bottom: 1rem;
  }
  .card h2 { margin: 0 0 0.5rem; font-size: 1.05rem; color: var(--text-primary, #222); }
  .card p { margin: 0 0 0.75rem; font-size: 0.9rem; color: var(--text-secondary, #555); }
  .user-info { font-size: 0.9rem; color: var(--text-primary, #222); }
  .muted { color: var(--text-secondary, #888); }
  .status { font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-secondary, #555); }
  .btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
  }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    gap: 1rem;
  }
  .setting-row + .setting-row { border-top: 1px solid var(--card-border, #eee); }
  .setting-label { font-size: 0.9rem; color: var(--text-primary, #222); }
  .setting-row select {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    font-size: 0.85rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
  .setting-row input[type="time"] {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    font-size: 0.85rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
  .color-picker {
    width: 40px;
    height: 36px;
    padding: 2px;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    cursor: pointer;
    background: none;
  }
  .color-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .btn-reset {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--text-secondary, #888);
  }
  .btn-reset:hover { background: var(--btn-secondary-bg, #eee); }
  .toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    cursor: pointer;
  }
  .toggle input { display: none; }
  .toggle-slider {
    position: absolute;
    inset: 0;
    background: var(--card-border, #ccc);
    border-radius: 999px;
    transition: background 0.2s;
  }
  .toggle-slider::before {
    content: '';
    position: absolute;
    left: 3px;
    top: 3px;
    width: 18px;
    height: 18px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  .toggle input:checked + .toggle-slider { background: var(--text-secondary, #888); }
  .toggle input:checked + .toggle-slider::before { transform: translateX(20px); }
</style>
