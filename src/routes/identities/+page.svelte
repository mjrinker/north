<script lang="ts">
  import { identitiesStore, addIdentity, removeIdentity } from '../../stores/identities';
  import type { Identity } from '../../types';
  import Icon from '@iconify/svelte';

  let identities = $state<Identity[]>([]);
  identitiesStore.subscribe(v => (identities = v));

  let newName = $state('');

  function handleAdd(e: SubmitEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    addIdentity({ id: crypto.randomUUID(), name, goals: [], createdAt: new Date() });
    newName = '';
  }

  function handleDelete(ident: Identity) {
    if (confirm(`Delete “${ident.name}”?`)) removeIdentity(ident.id);
  }
</script>

<div class="page">
  <a class="back" href="/settings"><Icon icon="mdi:chevron-left" />Settings</a>
  <h1 class="page-title">Identities</h1>
  <p class="intro">Who you’re becoming. Name the person your habits add up to, like “Runner” or “Reader”.</p>

  <div class="group">
    {#each identities as ident (ident.id)}
      <div class="row">
        <a class="row-label ident-link" href="/identities/{ident.id}">
          <span class="ident-name">{ident.name}</span>
          {#if ident.goals.length}<span class="ident-goals">{ident.goals.join(' · ')}</span>{/if}
        </a>
        <button class="icon-btn" onclick={() => handleDelete(ident)} aria-label="Delete {ident.name}"><Icon icon="mdi:trash-can-outline" /></button>
      </div>
    {/each}
    <form class="row" onsubmit={handleAdd}>
      <input class="row-input" type="text" bind:value={newName} placeholder="Add an identity" aria-label="New identity name" />
      <button class="btn btn-sm" type="submit" disabled={!newName.trim()}>Add</button>
    </form>
  </div>
</div>

<style>
  .back {
    display: inline-flex;
    align-items: center;
    margin-left: -6px;
    font-size: var(--text-base);
  }

  .back :global(svg) { font-size: 22px; }

  .page-title { margin-bottom: var(--space-2); }

  .intro {
    color: var(--text-2);
    margin-bottom: var(--space-5);
  }

  .ident-link {
    display: flex;
    flex-direction: column;
    padding: var(--space-1) 0;
    color: var(--text);
  }

  .ident-name { font-weight: 500; }

  .ident-goals {
    font-size: var(--text-sm);
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .icon-btn { color: var(--text-3); font-size: 20px; }
</style>
