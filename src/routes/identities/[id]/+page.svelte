<script lang="ts">
  import { identitiesStore, updateIdentity, removeIdentity } from '../../../stores/identities';
  import type { Identity } from '../../../types';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Icon from '@iconify/svelte';

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

<div class="page">
  <a class="back" href="/identities"><Icon icon="mdi:chevron-left" />Identities</a>
  {#if identity}
    <h1 class="page-title">{nameVal || 'Identity'}</h1>

    <form class="form" onsubmit={e => { e.preventDefault(); handleSave(); }}>
      <div class="field">
        <label for="ident-name">Name</label>
        <input id="ident-name" type="text" bind:value={nameVal} required />
      </div>
      <div class="field">
        <label for="ident-desc">Description</label>
        <textarea id="ident-desc" bind:value={descVal} placeholder="What this identity means to you"></textarea>
      </div>
      <div class="field">
        <label for="ident-goals">Goals</label>
        <input id="ident-goals" type="text" bind:value={goalsString} placeholder="Separate goals with commas" />
      </div>
      <div class="actions">
        <button type="button" class="btn btn-plain delete" onclick={handleDelete}>Delete</button>
        <button type="submit" class="btn">Save</button>
      </div>
    </form>
  {:else}
    <p class="empty">This identity doesn’t exist anymore.</p>
  {/if}
</div>

<style>
  .back {
    display: inline-flex;
    align-items: center;
    margin-left: -6px;
  }

  .back :global(svg) { font-size: 22px; }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .actions {
    display: flex;
    justify-content: space-between;
    margin-top: var(--space-2);
  }

  .delete {
    color: var(--danger);
    padding-left: 0;
  }
</style>
