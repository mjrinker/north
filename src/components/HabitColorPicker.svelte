<script lang="ts">
  import Icon from '@iconify/svelte';
  let { color = $bindable('') } = $props();

  let open = $state(false);
  let draft = $state('');

  // Mid-tone hues that read on both light and dark surfaces.
  const PRESETS = [
    '#d9534f', '#e0773c', '#d39a2a', '#8fa83a', '#3f9b62', '#2f9690',
    '#3a8fc7', '#4a6fd1', '#7660c9', '#b45bb0', '#8a7a6b', '#6b7785',
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

<button type="button" class="trigger" onclick={openPicker}>
  <span class="swatch-mini" class:empty={!color} style="background: {color || 'transparent'};"></span>
  <span class="trigger-label">{color ? 'Custom' : 'Default'}</span>
  <Icon icon="mdi:chevron-right" class="trigger-chev" />
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
        <input type="color" value={draft || '#4a6fd1'} oninput={(e) => draft = (e.currentTarget as HTMLInputElement).value} />
        <span class="custom-label">Custom</span>
        <span class="hex">{draft ? draft.toUpperCase() : 'None'}</span>
      </div>
      <div class="sub-actions">
        <button type="button" class="btn btn-secondary" onclick={cancel}>Cancel</button>
        <button type="button" class="btn" onclick={confirm}>Done</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .sub-overlay {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: var(--scrim);
  }

  .sub-picker {
    width: 100%;
    max-height: 80dvh;
    overflow-y: auto;
    padding: var(--space-4) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom));
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--bg);
    box-shadow: var(--shadow-sheet);
    animation: rise 0.25s var(--ease);
  }

  @keyframes rise { from { transform: translateY(30%); opacity: 0.5; } }

  @media (min-width: 640px) {
    .sub-overlay { align-items: center; }
    .sub-picker { max-width: 420px; border-radius: var(--radius-lg); }
  }

  .sub-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-4);
  }

  .sub-header h3 {
    font-size: var(--text-md);
    font-weight: 650;
  }

  .sub-close {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--text-2);
    font-size: 20px;
    line-height: 1;
  }

  .sub-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }

  .sub-actions .btn { min-width: 96px; }

  .trigger {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    text-align: left;
  }

  .trigger-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trigger :global(.trigger-chev) {
    color: var(--text-3);
    font-size: 18px;
  }

  .swatch-mini {
    display: block;
    flex: 0 0 22px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
  }

  .swatch-mini.empty {
    border: 1.5px dashed var(--separator-strong);
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: var(--space-3);
  }

  .swatch {
    aspect-ratio: 1;
    border-radius: 50%;
    transition: transform 0.1s var(--ease);
  }

  .swatch:active { transform: scale(0.92); }

  .swatch.selected {
    box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--text);
  }

  .swatch.none {
    border: 1.5px dashed var(--separator-strong);
    color: var(--text-3);
    font-size: 14px;
  }

  .custom-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-4);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .custom-row input[type='color'] {
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    cursor: pointer;
  }

  .custom-row input[type='color']::-webkit-color-swatch-wrapper { padding: 0; }
  .custom-row input[type='color']::-webkit-color-swatch { border: none; border-radius: 50%; }

  .custom-label { flex: 1; }

  .hex {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--text-2);
  }
</style>
