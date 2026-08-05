<script lang="ts">
  import { user, renderGoogleButton, signOut } from '../../stores/auth'
  import { apiSyncProvider } from '../../services/sync.providers/api'
  import { get } from 'svelte/store'
  import { appSettings, updateSettings, type AppSettings, type ThemeMode, type LaunchScreen } from '../../lib/settings'
  import ColorPickerModal from '../../components/ColorPickerModal.svelte'
  import { resolveThemeMode } from '../../stores/theme'
  import { habitsStore } from '../../stores/habits'
  import { pauseAllHabits, resumeAllHabits } from '../../lib/habitUtils'
  import { onDestroy } from 'svelte'
  import { getMyApiKeys, createMyApiKey, revokeMyApiKey, copyToClipboard, type ApiKey } from '../../lib/apiKeys'

  let currentUser = $state<any>(null)
  let syncing = $state(false)
  let syncStatus = $state('')
  let lastSynced = $state<string | null>(null)

  let allHabitsNow = $state<any[]>([])
  let unsubHabits = habitsStore.subscribe(v => allHabitsNow = v)
  onDestroy(() => unsubHabits())
  let pausedCount = $derived(allHabitsNow.filter((h: any) => h.status === 'paused').length)
  let pauseAllUntil = $state('')
  let pauseAllIndefinite = $state(false)
  let pauseMsg = $state('')

  function handlePauseAll() {
    const until = pauseAllIndefinite ? undefined : (pauseAllUntil || undefined)
    pauseAllHabits(until)
    pauseMsg = until ? `All habits paused until ${until}.` : 'All habits paused indefinitely.'
  }

  function handleResumeAll() {
    resumeAllHabits()
    pauseMsg = 'All habits resumed.'
  }

  let s = $state<AppSettings>(get(appSettings))

  $effect(() => {
    const unsub = appSettings.subscribe(v => s = v)
    return unsub
  })

  function update(partial: Partial<AppSettings>) {
    updateSettings(partial)
  }

  let pickerType = $state<'accent' | 'main' | null>(null);
  let prevAccentColor = $state('');
  let prevMainColor = $state('');
  let undoAccent = $state(false);
  let undoMain = $state(false);

  function openPicker(type: 'accent' | 'main') {
    prevAccentColor = s.accentColor || '#0066cc';
    prevMainColor = s.mainColor || '#1a1a2e';
    undoAccent = false;
    undoMain = false;
    pickerType = type;
  }

  function handlePickerConfirm(hex: string, newMode: 'light' | 'dark') {
    if (pickerType === 'accent') {
      if (hex !== prevAccentColor) undoAccent = true;
      update({ accentColor: hex });
    } else {
      if (hex !== prevMainColor || newMode !== resolveThemeMode(s.themeMode)) undoMain = true;
      update({ mainColor: hex, themeMode: newMode });
    }
    pickerType = null;
  }

  function handlePickerClose() {
    pickerType = null;
  }

  function undoAccentColor() {
    update({ accentColor: prevAccentColor });
    undoAccent = false;
  }

  function undoMainColor() {
    update({ mainColor: prevMainColor });
    undoMain = false;
  }

  user.subscribe(async (u) => { currentUser = u })

  let googleBtnEl = $state<HTMLDivElement | null>(null)

  $effect(() => {
    if (googleBtnEl) renderGoogleButton(googleBtnEl)
  })

  async function syncNow() {
    if (!currentUser) return
    syncing = true
    syncStatus = 'Downloading…'
    try {
      await apiSyncProvider.downloadAll()
      syncStatus = 'Uploading…'
      const result = await apiSyncProvider.uploadAll()
      syncStatus = result.status === 'success' ? 'Synced successfully' : `Sync error: ${result.status}`
      lastSynced = new Date().toLocaleTimeString()
    } catch (e: any) {
      syncStatus = `Sync failed: ${e.message}`
    }
    syncing = false
  }

  let myKeys = $state<ApiKey[]>([])
  let newKeyName = $state('')
  let apiMsg = $state('')
  let apiBusy = $state(false)

  async function loadMyKeys() {
    try {
      myKeys = await getMyApiKeys()
    } catch (e: any) {
      apiMsg = `Could not load keys: ${e.message}`
    }
  }

  $effect(() => {
    if (currentUser) loadMyKeys()
    else myKeys = []
  })

  async function generateKey() {
    if (!currentUser || apiBusy) return
    apiBusy = true
    apiMsg = ''
    try {
      const key = await createMyApiKey(newKeyName.trim() || undefined)
      await loadMyKeys()
      newKeyName = ''
      apiMsg = 'Key created. Copy it now — it is shown in full only on creation.'
      const ok = await copyToClipboard(key.apiKey)
      if (ok) apiMsg = 'Key created and copied to clipboard.'
    } catch (e: any) {
      apiMsg = `Could not create key: ${e.message}`
    }
    apiBusy = false
  }

  async function copyKey(k: ApiKey) {
    const ok = await copyToClipboard(k.apiKey)
    apiMsg = ok ? `Copied key for "${k.name || 'unnamed key'}"` : 'Copy failed'
  }

  async function revokeKey(k: ApiKey) {
    if (!confirm(`Revoke key "${k.name || 'unnamed key'}"? External tools using it will stop working.`)) return
    try {
      await revokeMyApiKey(k.id)
      myKeys = myKeys.filter(x => x.id !== k.id)
      apiMsg = 'Key revoked.'
    } catch (e: any) {
      apiMsg = `Could not revoke key: ${e.message}`
    }
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
      <div class="color-row">
        <button class="color-btn" onclick={() => openPicker('accent')} aria-label="Choose accent color">
          <span class="color-swatch" style="background: {s.accentColor || '#0066cc'};"></span>
          <span class="color-label">{s.accentColor || '#0066cc'}</span>
        </button>
        {#if undoAccent}
          <button class="btn-undo" onclick={undoAccentColor}>Undo</button>
        {/if}
      </div>
    </div>
    <div class="setting-row">
      <span class="setting-label">Main color</span>
      <div class="color-row">
        <button class="color-btn" onclick={() => openPicker('main')} aria-label="Choose main color">
          <span class="color-swatch" style="background: {s.mainColor || '#1a1a2e'};"></span>
          <span class="color-label">{s.mainColor || 'None'}</span>
        </button>
        {#if s.mainColor}
          <button class="btn-reset" onclick={() => update({ mainColor: '' })}>Reset</button>
        {/if}
        {#if undoMain}
          <button class="btn-undo" onclick={undoMainColor}>Undo</button>
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
      <div class="google-btn-wrap" bind:this={googleBtnEl}></div>
    {/if}
  </section>

  <section class="card">
    <h2>Cloud Sync</h2>
    <p>Sync your habits, entries, and identities to the cloud for backup.</p>
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

  <section class="card">
    <h2>API Key</h2>
    <p>Use an API key to connect external tools to the North API. It grants full access to your account data — keep it secret. See the <a class="docs-link" href="/api-docs">API documentation</a> for examples.</p>
    {#if currentUser}
      {#if myKeys.length > 0}
        <div class="api-key-list">
          {#each myKeys as k (k.id)}
            <div class="api-key-row">
              <span class="api-key-name">{k.name || 'Unnamed key'}</span>
              <div class="api-key-actions">
                <button class="btn" onclick={() => copyKey(k)}>Copy</button>
                <button class="btn btn-danger" onclick={() => revokeKey(k)}>Revoke</button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">You don't have any API keys yet.</p>
      {/if}
      <div class="api-key-new">
        <input type="text" placeholder="Label (optional)" bind:value={newKeyName} disabled={apiBusy} />
        <button class="btn" onclick={generateKey} disabled={apiBusy}>{apiBusy ? 'Creating…' : 'Generate key'}</button>
      </div>
      {#if apiMsg}
        <p class="status">{apiMsg}</p>
      {/if}
    {:else}
      <p class="muted">Sign in above to manage an API key.</p>
    {/if}
  </section>

  <section class="card">
    <h2>Pause All Habits</h2>
    <p>Temporarily pause every active habit at once.</p>
    <div class="pause-controls">
      <label class="pause-until-label">
        Until
        <input type="date" bind:value={pauseAllUntil} disabled={pauseAllIndefinite} />
      </label>
      <label class="pause-indef">
        <input type="checkbox" bind:checked={pauseAllIndefinite} />
        Indefinitely
      </label>
    </div>
    <div class="pause-btns">
      <button class="btn" onclick={handlePauseAll}>Pause all habits</button>
      <button class="btn" onclick={handleResumeAll} disabled={pausedCount === 0}>Resume all habits</button>
    </div>
    {#if pausedCount > 0}
      <p class="muted">{pausedCount} habit(s) currently paused.</p>
    {/if}
    {#if pauseMsg}
      <p class="status">{pauseMsg}</p>
    {/if}
  </section>
</div>

{#if pickerType}
  <ColorPickerModal
    title={pickerType === 'accent' ? 'Accent Color' : 'Main Color'}
    currentHex={pickerType === 'accent' ? (s.accentColor || '#0066cc') : (s.mainColor || '#1a1a2e')}
    themeMode={resolveThemeMode(s.themeMode)}
    pickerType={pickerType}
    onConfirm={handlePickerConfirm}
    onClose={handlePickerClose}
  />
{/if}

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
  .google-btn-wrap {
    display: flex;
    justify-content: flex-start;
    margin-top: 0.5rem;
  }
  .google-btn-wrap :global(div) {
    border-radius: 8px;
    overflow: hidden;
  }
  .google-btn-wrap :global(.google-signin-error) {
    margin: 0;
    font-size: 0.85rem;
    color: #d32f2f;
    line-height: 1.4;
  }
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
  .color-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 8px;
    background: var(--input-bg, #fff);
    cursor: pointer;
  }

  .color-btn:hover {
    background: var(--btn-secondary-bg, #eee);
  }

  .color-swatch {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid var(--card-border, #ccc);
    flex-shrink: 0;
  }

  .color-label {
    font-size: 0.85rem;
    color: var(--text-primary, #222);
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
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
  .btn-undo {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--accent, #0066cc);
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--accent, #0066cc);
  }
  .btn-undo:hover { background: var(--accent, #0066cc); color: var(--accent-text, #fff); }
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
  .pause-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }
  .pause-until-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--text-primary, #222);
  }
  .pause-until-label input[type="date"] {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    font-size: 0.85rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
  .pause-until-label input[type="date"]:disabled { opacity: 0.5; }
  .pause-indef {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.9rem;
    color: var(--text-primary, #222);
    cursor: pointer;
  }
  .pause-btns {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  .api-key-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .api-key-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--input-bg, #f5f5f5);
    border: 1px solid var(--card-border, #eee);
    border-radius: 8px;
  }
  .api-key-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary, #222);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .api-key-actions {
    display: flex;
    gap: 0.4rem;
    flex-shrink: 0;
  }
  .btn-danger {
    background: rgba(211, 47, 47, 0.1);
    color: #d32f2f;
    border-color: rgba(211, 47, 47, 0.3);
  }
  .api-key-new {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .api-key-new input {
    flex: 1;
    min-width: 0;
    padding: 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    font-size: 0.85rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
    box-sizing: border-box;
  }
  .docs-link {
    color: var(--accent, #0066cc);
    text-decoration: underline;
  }
</style>
