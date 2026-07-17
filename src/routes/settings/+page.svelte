<script lang="ts">
  import { user, signInWithGoogle, signOut } from '../../stores/auth'
  import { supabaseSyncProvider } from '../../services/sync.providers/supabase'
  import { loadPlaces, savePlaces } from '../../lib/places'
  import type { SuggestedPlace } from '../../types'

  let currentUser = $state<any>(null)
  let syncing = $state(false)
  let syncStatus = $state('')
  let lastSynced = $state<string | null>(null)

  let places = $state<SuggestedPlace[]>(loadPlaces())
  let addingPlace = $state(false)
  let newPlaceLabel = $state('')
  let placeError = $state('')

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

  async function addCurrentLocation() {
    if (!newPlaceLabel.trim()) { placeError = 'Enter a label'; return; }
    if (!navigator.geolocation) { placeError = 'Geolocation not available'; return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const place: SuggestedPlace = {
          id: crypto.randomUUID(),
          label: newPlaceLabel.trim(),
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          radius: 100,
        };
        places = [...places, place];
        savePlaces(places);
        newPlaceLabel = '';
        addingPlace = false;
        placeError = '';
      },
      () => { placeError = 'Could not get location. Check permissions.'; },
      { timeout: 10000 }
    );
  }

  function removePlace(id: string) {
    places = places.filter(p => p.id !== id);
    savePlaces(places);
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
    <h2>Places</h2>
    <p>Save your frequent locations so habits can suggest themselves when you're there.</p>
    {#if places.length > 0}
      <div class="place-list">
        {#each places as place}
          <div class="place-row">
            <span class="place-label">{place.label}</span>
            <button class="btn-small danger" onclick={() => removePlace(place.id)} aria-label="Remove">✕</button>
          </div>
        {/each}
      </div>
    {/if}
    {#if addingPlace}
      <div class="add-place">
        <input type="text" bind:value={newPlaceLabel} placeholder="Label (e.g. Home, Work)" />
        <button class="btn" onclick={addCurrentLocation}>Save Current Location</button>
        <button class="btn btn-secondary" onclick={() => { addingPlace = false; placeError = ''; }}>Cancel</button>
        {#if placeError}
          <p class="error">{placeError}</p>
        {/if}
      </div>
    {:else}
      <button class="btn" onclick={() => addingPlace = true}>Add Place</button>
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
  .btn-secondary {
    background: var(--card-bg, #f5f5f5);
    color: var(--text-primary, #222);
    border: 1px solid var(--card-border, #ccc);
  }
  .btn-small {
    padding: 0.2rem 0.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .btn-small.danger { background: transparent; color: #d32f2f; font-size: 1rem; }
  .place-list { margin-bottom: 0.75rem; }
  .place-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--card-border, #eee);
  }
  .place-label { font-size: 0.9rem; color: var(--text-primary, #222); }
  .add-place {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .add-place input {
    padding: 0.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    font-size: 0.85rem;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
  }
  .error { font-size: 0.8rem; color: #d32f2f; margin: 0; }
</style>
