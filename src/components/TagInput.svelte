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
    <input type="text" bind:value={input} onkeydown={handleKeydown} placeholder={tags.length ? "Add another" : "Add a tag and press return"} />
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
    align-items: center;
    gap: 6px;
    min-height: var(--tap);
    padding: 6px var(--space-2);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .tags-input:focus-within {
    box-shadow: 0 0 0 2px var(--accent);
  }

  .tags-input input {
    flex: 1;
    min-width: 120px;
    min-height: 30px;
    padding: 0 var(--space-1);
    border: none;
    background: none;
    color: var(--text);
    outline: none;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 28px;
    padding: 0 4px 0 10px;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .tag-remove {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    color: var(--text-3);
    font-size: 15px;
    line-height: 1;
  }

  .tag-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 20;
    padding: var(--space-1) 0;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-pop);
  }

  .tag-option {
    display: block;
    width: 100%;
    padding: 10px var(--space-4);
    text-align: left;
  }

  .tag-option:active {
    background: var(--surface-2);
  }
</style>
