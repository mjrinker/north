<script lang="ts">
  import { identitiesStore, updateIdentity, removeIdentity } from '../../../stores/identities';
  import type { Identity } from '../../../types';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  const id = $page.params.id;
  let identity = $derived(() => identitiesStore.find(i => i.id === id));

  let goalsString = $state('');

  // Update goalsString whenever identity changes
  $effect(() => {
    if (identity) {
      goalsString = identity.goals.join(', ');
    }
  });

  function handleSave() {
    if (!identity) return;
    
    // Update the identity object with the current goals string
    const updatedIdentity = {
      ...identity,
      goals: goalsString.split(',').map(g => g.trim()).filter(g => g !== '')
    };
    
    updateIdentity(updatedIdentity);
    goto('/identities');
  }

  function handleDelete() {
    if (!identity) return;
    removeIdentity(identity.id);
    goto('/identities');
  }
</script>

<div style="padding: 1rem; max-width: 600px;">
  {#if identity}
    <h1>{identity.name} - Identity</h1>

    <form style="display: flex; flex-direction: column; gap: 1rem;" onsubmit={(e) => e.preventDefault()}>
      <label>
        Name:
        <input type="text" bind:value={identity.name} required />
      </label>

      <label>
        Description:
        <textarea bind:value={identity.description} required></textarea>
      </label>

      <label>
        Goals:
        <input type="text" bind:value={goalsString} placeholder="Comma-separated goals" />
      </label>

      <div style="display: flex; gap: 1rem;">
        <button type="button" onclick={handleSave}>Save</button>
        <button type="button" onclick={handleDelete}>Delete</button>
      </div>
    </form>
  {:else}
    <p>Identity not found.</p>
  {/if}
</div>