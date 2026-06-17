// src/routes/identities/[id]/+page.svelte
<nav style="padding: 1rem; background: #f5f5f5;">
  <a href="/identities">Back</a>
</nav>

<script lang="ts">
  import { identitiesStore, updateIdentity, removeIdentity } from '../../../stores/identities';
  import type { Identity } from '../../../types';
  import { page } from '$app/stores';

  let identity: Identity = { id: page.params.id, name: '' };
  $: identity = identitiesStore.find(i => i.id === page.params.id);

  function updateIdentityForm() {
    if (!identity) return;
    updateIdentity(identity);
    goto('/identities');
  }
</script>

<h1>{identity.name} - Identity</h1>

<form style="max-width: 600px; padding: 1rem;">
  <label>Name:</label><br/>
  <input type="text" bind:value={identity.name} required/>

  <label>Description:</label><br/>
  <textarea bind:value={identity.description}></textarea/>

  <label>Goals:</label><br/>
  <input type="text" bind:value={identity.goals.join(" ")}' placeholder="Comma-separated goals" required/>

  <button type="submit" on:click={updateIdentityForm}>Save</button>
  <button type="button" on:click={() => removeIdentity(identity.id)}} Confirm Delete? {identity.name}</button>
</form>
