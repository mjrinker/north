<script lang="ts">
  import { identitiesStore, updateIdentity, removeIdentity } from '../../../stores/identities';
  import type { Identity } from '../../../types';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  const id = $page.params.id;
  let identities = $state<Identity[]>([]);
  identitiesStore.subscribe(v => (identities = v));

  let identity = $derived(identities.find(i => i.id === id));

  let nameVal = $state('');
  let descVal = $state('');
  let goalsString = $state('');

  $effect(() => {
    if (identity) {
      nameVal = identity.name;
      descVal = identity.description ?? '';
      goalsString = identity.goals.join(', ');
    }
  });

  function handleSave() {
    if (!identity) return;
    const updated = {
      ...identity,
      name: nameVal,
      description: descVal,
      goals: goalsString.split(',').map(g => g.trim()).filter(g => g !== ''),
      createdAt: identity.createdAt
    };
    updateIdentity(updated);
    goto('/identities');
  }

  function handleDelete() {
    if (!identity) return;
    if (confirm('Delete this identity?')) {
      removeIdentity(identity.id);
      goto('/identities');
    }
  }
</script>

<div style="padding: 1rem; max-width: 600px;">
  {#if identity}
    <h1>{nameVal} - Identity</h1>

    <form style="display: flex; flex-direction: column; gap: 1rem;" onsubmit={e => e.preventDefault()}>
      <label>
        Name:
        <input type="text" bind:value={nameVal} required />
      </label>

      <label>
        Description:
        <textarea bind:value={descVal}></textarea>
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
