<script lang="ts">
  let { color = $bindable('') } = $props();

  let open = $state(false);
  let draft = $state('');

  const PRESETS = [
    '#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab', '#1e88e5',
    '#039be5', '#00acc1', '#00897b', '#43a047', '#7cb342', '#c0ca33',
    '#fdd835', '#ffb300', '#fb8c00', '#f4511e', '#6d4c41', '#546e7a',
  ];

  function openPicker() {
    draft = color;
    open = true;
  }
  function confirm() {
    color = draft;
    open = false;
  }
  function cancel() {
    open = false;
  }
</script>

<button type="button" class="color-trigger" onclick={openPicker}>
  <span class="swatch-mini" style="background: {color || 'transparent'};"></span>
  <span class="trigger-label">{color || 'No color'}</span>
  <span class="trigger-edit">Edit</span>
</button>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
  <div class="sub-overlay" onclick={cancel} onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Escape') cancel(); }}>
    <div class="sub-picker" onclick={(e) => e.stopPropagation()}>
      <div class="sub-header">
        <h3>Color</h3>
        <button type="button" class="sub-close" onclick={cancel} aria-label="Close">&times;</button>
      </div>
      <div class="swatches">
        <button type="button" class="swatch none" class:selected={!draft} onclick={() => draft = ''} aria-label="No color" title="No color">✕</button>
        {#each PRESETS as c}
          <button
            type="button"
            class="swatch"
            class:selected={draft === c}
            style="background: {c};"
            onclick={() => draft = c}
            aria-label={c}
            title={c}
          ></button>
        {/each}
      </div>
      <div class="custom-row">
        <input type="color" value={draft || '#0066cc'} oninput={(e) => draft = (e.currentTarget as HTMLInputElement).value} />
        <span class="custom-label">Custom</span>
        <span class="hex">{draft ? draft.toUpperCase() : 'None'}</span>
      </div>
      <div class="sub-actions">
        <button type="button" class="btn btn-cancel" onclick={cancel}>Cancel</button>
        <button type="button" class="btn btn-ok" onclick={confirm}>OK</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .color-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 0;
    background: var(--input-bg, #fff);
    color: var(--text-primary, #222);
    font-size: 0.85rem;
    cursor: pointer;
    margin-bottom: 0.75rem;
  }
  .color-trigger:hover { background: var(--btn-secondary-bg, #eee); }
  .swatch-mini {
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 50%;
    border: 1px solid var(--card-border, #ccc);
  }
  .trigger-label { font-weight: 500; }
  .trigger-edit { font-size: 0.75rem; color: var(--text-secondary, #888); }

  .sub-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1200;
  }
  .sub-picker {
    background: var(--card-bg, #fff);
    border-radius: 10px;
    width: 90vw;
    max-width: 360px;
    padding: 1.1rem;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
  }
  .sub-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  .sub-header h3 { margin: 0; font-size: 1.05rem; color: var(--text-primary, #222); }
  .sub-close {
    background: none;
    border: none;
    font-size: 1.4rem;
    line-height: 1;
    color: var(--text-secondary, #999);
    cursor: pointer;
    padding: 0.25rem;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(2rem, 1fr));
    gap: 0.4rem;
    margin-bottom: 0.75rem;
  }
  .swatch {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    box-sizing: border-box;
    justify-self: center;
  }
  .swatch.selected { border-color: var(--text-primary, #222); box-shadow: 0 0 0 2px var(--card-bg, #fff) inset; }
  .swatch.none {
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-secondary, #888);
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .custom-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.9rem;
  }
  .custom-row input[type="color"] {
    width: 2rem;
    height: 2rem;
    border: 2px solid transparent;
    border-radius: 50%;
    padding: 0;
    background: none;
    cursor: pointer;
  }
  .custom-row input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
  .custom-row input[type="color"]::-webkit-color-swatch { border: none; border-radius: 50%; }
  .custom-label { font-size: 0.85rem; color: var(--text-primary, #222); }
  .hex {
    margin-left: auto;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary, #222);
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  }
  .sub-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .btn {
    padding: 0.45rem 1.1rem;
    border-radius: 0;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
  }
  .btn-cancel { background: var(--btn-secondary-bg, #eee); color: var(--text-primary, #222); }
  .btn-ok { background: var(--accent, #0066cc); color: var(--accent-text, #fff); }
</style>
