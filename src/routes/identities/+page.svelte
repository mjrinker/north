<script lang="ts">
  import { identitiesStore, addIdentity, removeIdentity } from '../../stores/identities';
  import type { Identity } from '../../types';
  import { goto } from '$app/navigation';

let identities = $state<Identity[]>([]);
identitiesStore.subscribe(v => (identities = v));

  function handleDelete(id: string) {
    if (confirm('Delete this identity?')) removeIdentity(id);
  }
</script>

<div style="padding: 1rem;">
  <h1>Identities</h1>
  <ul>
    {#each identities as ident (ident.id)}
      <li>
        <a href="/identities/{ident.id}">{ident.name}</a>
        <button onclick={() => handleDelete(ident.id)} style="margin-left: 0.5rem;">Delete</button>
      </li>
    {/each}
  </ul>
  <a href="/identities/add" style="text-decoration:none;color:#007acc;">+ Add Identity</a>
</div>
