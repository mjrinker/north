<script lang="ts">
  import { user, renderGoogleButton } from '../../stores/auth'
  import { apiSyncProvider } from '../../services/sync.providers/api'
  import { get } from 'svelte/store'
  import { appSettings, updateSettings, type AppSettings, type ThemeMode, type LaunchScreen } from '../../lib/settings'
  import ColorPickerModal from '../../components/ColorPickerModal.svelte'
  import LogoutConfirmModal from '../../components/LogoutConfirmModal.svelte'
  import { resolveThemeMode } from '../../stores/theme'
  import { habitsStore } from '../../stores/habits'
  import { pauseAllHabits, resumeAllHabits } from '../../lib/habitUtils'
  import { onDestroy } from 'svelte'
  import { getMyApiKeys, createMyApiKey, revokeMyApiKey, copyToClipboard, type ApiKey } from '../../lib/apiKeys'
  import { getLastSyncedAt, setLastSyncedAt, daysAgo } from '../../services/syncState'
  import { userRoles } from '../../stores/roles'
  import { userHasPermission } from '../../lib/featureFlags'
  import Icon from '@iconify/svelte'

  let roles = $state<string[]>([])
  userRoles.subscribe(v => roles = v)

  let currentUser = $state<any>(null)
  let syncing = $state(false)
  let syncStatus = $state('')
  let lastSynced = $state<string | null>(null)
  let syncMenuOpen = $state(false)
  let customOpen = $state(false)
  let customFrom = $state('')
  let customTo = $state('')

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
  let showLogoutConfirm = $state(false);
  let prevAccentColor = $state('');
  let prevMainColor = $state('');
  let undoAccent = $state(false);
  let undoMain = $state(false);

  function openPicker(type: 'accent' | 'main') {
    prevAccentColor = s.accentColor;
    prevMainColor = s.mainColor;
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

  const RANGE_PRESETS = [
    { label: 'Today', days: 0 },
    { label: 'Last 2 days', days: 2 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
  ] as const

  async function syncNow(_opts?: { days?: number; from?: string; to?: string; allTime?: boolean }) {
    if (!currentUser) return
    syncing = true
    syncStatus = 'Downloading…'
    try {
      let lastSyncedAtMs = 0
      const prev = getLastSyncedAt()
      if (prev) { const t = new Date(prev).getTime(); if (!Number.isNaN(t)) lastSyncedAtMs = t }
      const since = new Date(lastSyncedAtMs)

      if (_opts?.allTime) {
        await apiSyncProvider.downloadAll()
      } else if (_opts?.from && _opts?.to) {
        await apiSyncProvider.downloadAll({ dateFrom: _opts.from, dateTo: _opts.to })
      } else {
        const days = _opts?.days ?? 7
        await apiSyncProvider.downloadAll({ dateFrom: daysAgo(days) })
      }

      syncStatus = 'Uploading…'
      const result = await apiSyncProvider.uploadAll({ since: _opts?.allTime ? null : since })
      syncStatus = result.status === 'success' ? (lastSyncedAtMs > 0 ? 'Synced successfully' : 'Initial sync complete') : `Sync error: ${result.status}`
      setLastSyncedAt(new Date().toISOString())
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

<div class="page settings">
  <h1 class="page-title">Settings</h1>

  {#if currentUser}
    <div class="group">
      <div class="row profile">
        {#if currentUser.user_metadata?.avatar_url}
          <img class="avatar" src={currentUser.user_metadata.avatar_url} alt="" referrerpolicy="no-referrer" />
        {:else}
          <span class="avatar placeholder"><Icon icon="mdi:account" /></span>
        {/if}
        <div class="row-label">
          <div class="profile-name">{currentUser.name ?? currentUser.email}</div>
          {#if currentUser.name}<div class="profile-email">{currentUser.email}</div>{/if}
        </div>
      </div>
      <a class="row link" href="/accountability">
        <span class="row-label">Accountability partners</span>
        <Icon icon="mdi:chevron-right" class="chev" />
      </a>
      {#if userHasPermission(roles, 'access_admin')}
        <a class="row link" href="/admin">
          <span class="row-label">Admin</span>
          <Icon icon="mdi:chevron-right" class="chev" />
        </a>
      {/if}
    </div>
  {:else}
    <div class="group signin">
      <div class="signin-copy">
        <div class="signin-title">Sync across devices</div>
        <p>Sign in to back up your habits and use North on more than one device. Everything works offline without an account.</p>
      </div>
      <div class="google-btn-wrap" bind:this={googleBtnEl}></div>
    </div>
  {/if}

  <h2 class="section-label">Appearance</h2>
  <div class="group">
    <div class="row">
      <span class="row-label">Theme</span>
      <select class="inline-select" value={s.themeMode} onchange={(e) => update({ themeMode: (e.target as HTMLSelectElement).value as ThemeMode })} aria-label="Theme">
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="adaptive">By time of day</option>
      </select>
    </div>
    <label class="row">
      <span class="row-label">True black in dark mode</span>
      <input type="checkbox" class="switch" checked={s.oled} onchange={(e) => update({ oled: (e.target as HTMLInputElement).checked })} />
    </label>
    <div class="row">
      <span class="row-label">Accent color</span>
      {#if undoAccent}<button class="btn btn-plain btn-sm" onclick={undoAccentColor}>Undo</button>{/if}
      <button class="swatch-btn" onclick={() => openPicker('accent')} aria-label="Choose accent color">
        <span class="swatch" style="background: {s.accentColor || 'var(--accent)'}"></span>
        <Icon icon="mdi:chevron-right" class="chev" />
      </button>
    </div>
    <div class="row">
      <span class="row-label">Background tint</span>
      {#if undoMain}<button class="btn btn-plain btn-sm" onclick={undoMainColor}>Undo</button>{/if}
      {#if s.mainColor}<button class="btn btn-plain btn-sm" onclick={() => update({ mainColor: '' })}>Reset</button>{/if}
      <button class="swatch-btn" onclick={() => openPicker('main')} aria-label="Choose background tint">
        {#if s.mainColor}
          <span class="swatch" style="background: {s.mainColor}"></span>
        {:else}
          <span class="row-value">None</span>
        {/if}
        <Icon icon="mdi:chevron-right" class="chev" />
      </button>
    </div>
  </div>

  <h2 class="section-label">Organize</h2>
  <div class="group">
    <a class="row link" href="/tags">
      <span class="row-label">Tags</span>
      <Icon icon="mdi:chevron-right" class="chev" />
    </a>
    <a class="row link" href="/identities">
      <span class="row-label">Identities</span>
      <Icon icon="mdi:chevron-right" class="chev" />
    </a>
  </div>

  <h2 class="section-label">Your day</h2>
  <div class="group">
    <div class="row">
      <span class="row-label">New day starts at</span>
      <input class="inline-select" type="time" value={s.resetTime} oninput={(e) => update({ resetTime: (e.target as HTMLInputElement).value })} aria-label="New day starts at" />
    </div>
    <div class="row">
      <span class="row-label">Open the app to</span>
      <select class="inline-select" value={s.launchScreen} onchange={(e) => update({ launchScreen: (e.target as HTMLSelectElement).value as LaunchScreen })} aria-label="Launch screen">
        <option value="/today">Today</option>
        <option value="/history">History</option>
        <option value="/stats">Stats</option>
        <option value="/settings">Settings</option>
      </select>
    </div>
  </div>
  <p class="section-footnote">Anything you log before this time counts toward the previous day.</p>

  <h2 class="section-label">Pause everything</h2>
  <div class="group">
    <label class="row">
      <span class="row-label">Until I resume</span>
      <input type="checkbox" class="switch" bind:checked={pauseAllIndefinite} />
    </label>
    {#if !pauseAllIndefinite}
      <div class="row">
        <span class="row-label">Resume on</span>
        <input class="inline-select" type="date" bind:value={pauseAllUntil} aria-label="Resume on" />
      </div>
    {/if}
    <button class="row action" onclick={handlePauseAll}>Pause all habits</button>
    {#if pausedCount > 0}
      <button class="row action" onclick={handleResumeAll}>Resume {pausedCount} paused habit{pausedCount === 1 ? '' : 's'}</button>
    {/if}
  </div>
  <p class="section-footnote">{pauseMsg || 'Useful for travel or illness.'}</p>

  {#if currentUser}
    <h2 class="section-label">Sync</h2>
    <div class="group">
      <button class="row action" onclick={() => { syncMenuOpen = false; syncNow() }} disabled={syncing}>
        {syncing ? 'Syncing…' : 'Sync now'}
      </button>
      <button class="row link" onclick={() => syncMenuOpen = !syncMenuOpen} aria-expanded={syncMenuOpen}>
        <span class="row-label">Download a date range</span>
        <Icon icon="mdi:chevron-down" class="chev {syncMenuOpen ? 'open' : ''}" />
      </button>
      {#if syncMenuOpen}
        {#each RANGE_PRESETS as preset (preset.days)}
          <button class="row sub" onclick={() => syncNow({ days: preset.days })} disabled={syncing}>{preset.label}</button>
        {/each}
        <button class="row sub" onclick={() => syncNow({ allTime: true })} disabled={syncing}>All time</button>
        <button class="row sub" onclick={() => customOpen = !customOpen}>Custom range…</button>
        {#if customOpen}
          <div class="row custom-range">
            <input class="inline-select" type="date" bind:value={customFrom} aria-label="From" />
            <span class="row-value">to</span>
            <input class="inline-select" type="date" bind:value={customTo} aria-label="To" />
            <button class="btn btn-sm" onclick={() => { if (customFrom && customTo) syncNow({ from: customFrom, to: customTo }) }} disabled={!customFrom || !customTo}>Go</button>
          </div>
        {/if}
      {/if}
    </div>
    <p class="section-footnote">
      {#if syncStatus}{syncStatus}{:else if lastSynced}Last synced {lastSynced}.{:else}Changes sync automatically when you’re online.{/if}
    </p>

    <h2 class="section-label">API keys</h2>
    <div class="group">
      {#each myKeys as k (k.id)}
        <div class="row">
          <span class="row-label">{k.name || 'Unnamed key'}</span>
          <button class="btn btn-sm btn-secondary" onclick={() => copyKey(k)}>Copy</button>
          <button class="btn btn-sm btn-danger" onclick={() => revokeKey(k)}>Revoke</button>
        </div>
      {/each}
      <div class="row new-key">
        <input class="row-input" type="text" placeholder="New key name" bind:value={newKeyName} disabled={apiBusy} aria-label="New key name" />
        <button class="btn btn-sm" onclick={generateKey} disabled={apiBusy}>{apiBusy ? 'Creating…' : 'Create'}</button>
      </div>
    </div>
    <p class="section-footnote">{apiMsg || ''} Keys give full access to your data, for tools like iOS Shortcuts. See the <a href="/api-docs">API documentation</a>.</p>

    <div class="group signout">
      <button class="row action danger" onclick={() => showLogoutConfirm = true}>Sign out</button>
    </div>
  {/if}
</div>

{#if pickerType}
  <ColorPickerModal
    title={pickerType === 'accent' ? 'Accent color' : 'Background tint'}
    currentHex={pickerType === 'accent' ? (s.accentColor || '#2b62c9') : (s.mainColor || '#8a7a6b')}
    themeMode={resolveThemeMode(s.themeMode)}
    pickerType={pickerType}
    onConfirm={handlePickerConfirm}
    onClose={handlePickerClose}
  />
{/if}

{#if showLogoutConfirm}
  <LogoutConfirmModal onClose={() => showLogoutConfirm = false} />
{/if}

<style>
  .profile {
    min-height: 68px;
  }

  .avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .avatar.placeholder {
    display: grid;
    place-items: center;
    background: var(--surface-2);
    color: var(--text-3);
    font-size: 26px;
  }

  .profile-name {
    font-size: var(--text-md);
    font-weight: 600;
  }

  .profile-email {
    font-size: var(--text-sm);
    color: var(--text-2);
  }

  .signin {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .signin-title {
    font-weight: 600;
    font-size: var(--text-md);
    margin-bottom: 2px;
  }

  .signin p {
    font-size: var(--text-sm);
    color: var(--text-2);
  }

  .google-btn-wrap :global(.google-signin-error) {
    font-size: var(--text-sm);
    color: var(--danger);
  }

  .row.link,
  .row.action,
  .row.sub {
    width: 100%;
    text-align: left;
    color: var(--text);
    cursor: pointer;
  }

  .row.link:active,
  .row.action:active,
  .row.sub:active {
    background: var(--surface-2);
  }

  .row.action {
    color: var(--accent);
  }

  .row.action.danger {
    color: var(--danger);
  }

  .row:disabled {
    opacity: 0.5;
  }

  .row.sub {
    padding-left: var(--space-6);
    color: var(--accent);
  }

  .row :global(.chev) {
    font-size: 20px;
    color: var(--text-3);
    flex-shrink: 0;
    transition: transform 0.2s var(--ease);
  }

  .row :global(.chev.open) {
    transform: rotate(180deg);
  }

  label.row {
    cursor: pointer;
  }

  .swatch-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 36px;
  }

  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.15);
  }

  .inline-select {
    max-width: 55%;
    min-height: 32px;
    padding: 4px var(--space-2);
    border: none;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--text);
    font-size: var(--text-base);
    text-align: right;
  }

  select.inline-select {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 28px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none' stroke='%23908d89' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
  }

  .custom-range {
    flex-wrap: wrap;
  }

  .custom-range .inline-select {
    flex: 1;
    max-width: none;
  }

  .row-input {
    flex: 1;
    min-width: 0;
    min-height: 32px;
    border: none;
    background: none;
    color: var(--text);
    outline: none;
  }

  .signout {
    margin-top: var(--space-6);
  }

  .signout .row {
    justify-content: center;
  }
</style>
