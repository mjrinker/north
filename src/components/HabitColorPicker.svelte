<script lang="ts">
  let { color = $bindable('') } = $props();

  const PRESETS = [
    '#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab', '#1e88e5',
    '#039be5', '#00acc1', '#00897b', '#43a047', '#7cb342', '#c0ca33',
    '#fdd835', '#ffb300', '#fb8c00', '#f4511e', '#6d4c41', '#546e7a',
  ];
</script>

<div class="color-picker">
  <button
    type="button"
    class="swatch none"
    class:selected={!color}
    onclick={() => color = ''}
    aria-label="No color"
    title="No color"
  >✕</button>
  {#each PRESETS as c}
    <button
      type="button"
      class="swatch"
      class:selected={color === c}
      style="background: {c};"
      onclick={() => color = c}
      aria-label={c}
      title={c}
    ></button>
  {/each}
  <label class="custom" title="Custom color">
    <input type="color" value={color || '#0066cc'} oninput={(e) => color = (e.currentTarget as HTMLInputElement).value} />
    <span class="custom-label">Custom</span>
  </label>
</div>

<style>
  .color-picker {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }
  .swatch {
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    box-sizing: border-box;
  }
  .swatch.selected {
    border-color: var(--text-primary, #222);
    box-shadow: 0 0 0 2px var(--card-bg, #fff) inset;
  }
  .swatch.none {
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-secondary, #888);
    font-size: 0.8rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .custom {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    color: var(--text-secondary, #888);
    cursor: pointer;
  }
  .custom input[type="color"] {
    width: 1.6rem;
    height: 1.6rem;
    border: 2px solid transparent;
    border-radius: 50%;
    padding: 0;
    background: none;
    cursor: pointer;
  }
  .custom input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
  .custom input[type="color"]::-webkit-color-swatch { border: none; border-radius: 50%; }
</style>
