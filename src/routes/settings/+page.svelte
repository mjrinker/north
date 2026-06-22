<script lang="ts">
  import { user, signInWithGoogle, signOut } from '../../stores/auth'
  import { startBoxOAuth, getBoxTokens, clearBoxTokens } from '$lib/box'
  import { boxSyncProvider } from '../../services/sync.providers/box'

  let currentUser = $state<any>(null)
  let boxConnected = $state(false)
  let boxSyncing = $state(false)
  let boxStatus = $state('')

  user.subscribe(async (u) => {
    currentUser = u
    if (u) {
      const tokens = await getBoxTokens(u.id)
      boxConnected = !!tokens
    } else {
      boxConnected = false
    }
  })

  async function connectBox() {
    if (!currentUser) return
    startBoxOAuth(currentUser.id)
  }

  async function disconnectBox() {
    if (!currentUser) return
    await clearBoxTokens(currentUser.id)
    boxConnected = false
  }

  async function syncNow() {
    if (!currentUser) return
    boxSyncing = true
    boxStatus = 'Syncing…'
    try {
      const result = await boxSyncProvider.uploadAll()
      boxStatus = result.status === 'success' ? 'Synced successfully' : `Sync error: ${result.status}`
    } catch (e: any) {
      boxStatus = `Sync failed: ${e.message}`
    }
    boxSyncing = false
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
      <p>Sign in to enable Box cloud sync.</p>
      <button class="btn" onclick={signInWithGoogle}>Sign in with Google</button>
    {/if}
  </section>

  <section class="card">
    <h2>Box Cloud Sync</h2>
    <p>
      Sync your habits to your personal Box account.
    </p>
    {#if currentUser}
      {#if boxConnected}
        <p class="connected">✓ Connected to Box</p>
        <div class="btn-row">
          <button class="btn" onclick={syncNow} disabled={boxSyncing}>
            {boxSyncing ? 'Syncing…' : 'Sync Now'}
          </button>
          <button class="btn btn-danger" onclick={disconnectBox}>Disconnect</button>
        </div>
        {#if boxStatus}
          <p class="status">{boxStatus}</p>
        {/if}
      {:else}
        <button class="btn" onclick={connectBox}>Connect Box</button>
      {/if}
    {:else}
      <p class="muted">Sign in above to connect Box.</p>
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
  .btn-row { display: flex; gap: 0.5rem; }
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
  .btn-danger { background: #d32f2f; border-color: #d32f2f; }
</style>
