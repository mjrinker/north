<script lang="ts">
  import { user, signInWithGoogle, signOut } from '../../stores/auth'
  import { supabaseSyncProvider } from '../../services/sync.providers/supabase'

  let currentUser = $state<any>(null)
  let syncing = $state(false)
  let syncStatus = $state('')
  let lastSynced = $state<string | null>(null)

  user.subscribe(async (u) => {
    currentUser = u
  })

  async function syncNow() {
    if (!currentUser) return
    syncing = true
    syncStatus = 'Uploading…'
    try {
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
    <p>
      Sync your habits, entries, and identities to Supabase for backup.
    </p>
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
  .connected { color: #2e7d32; font-weight: 500; }
  .muted { color: var(--text-secondary, #888); }
  .status { font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-secondary, #555); }
  .btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    background: var(--accent, #0066cc);
    color: white;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
  }
  .btn:disabled { opacity: 0.5; cursor: default; }
</style>
