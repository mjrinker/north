<script lang="ts">
  let { tags = $bindable([] as string[]), allTags = [] as string[] } = $props();
  let input = $state('');

  let suggestions = $derived(
    input ? allTags.filter(t => t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t)) : []
  );

  function add(tag: string) {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) tags = [...tags, t];
    input = '';
  }

  function remove(tag: string) {
    tags = tags.filter(t => t !== tag);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input);
    }
  }
</script>

<div class="tags-input-wrap" onclick={(e) => e.stopPropagation()}>
  <div class="tags-input">
    {#each tags as tag}
      <span class="tag-chip">
        {tag}
        <button type="button" class="tag-remove" onclick={() => remove(tag)}>×</button>
      </span>
    {/each}
    <input type="text" bind:value={input} onkeydown={handleKeydown} placeholder="Type tag, press Enter" />
  </div>
  {#if input && suggestions.length > 0}
    <div class="tag-dropdown">
      {#each suggestions as s}
        <button type="button" class="tag-option" onclick={() => add(s)}>{s}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tags-input-wrap {
    position: relative;
  }
  .tags-input {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 4px;
    padding: 0.25rem;
    background: var(--input-bg, #fff);
  }
  .tags-input input {
    border: none;
    outline: none;
    flex: 1;
    min-width: 80px;
    padding: 0.25rem;
    font-size: 0.85rem;
    background: transparent;
    color: var(--text-primary, #222);
  }
  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--accent, #0066cc);
    color: white;
    font-size: 0.75rem;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .tag-remove {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0 2px;
    line-height: 1;
  }
  .tag-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 10;
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #ccc);
    border-top: none;
    border-radius: 0 0 4px 4px;
    max-height: 150px;
    overflow-y: auto;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  }
  .tag-option {
    display: block;
    width: 100%;
    padding: 0.35rem 0.5rem;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--text-primary, #222);
  }
  .tag-option:hover {
    background: var(--accent, #0066cc);
    color: white;
  }
</style>
