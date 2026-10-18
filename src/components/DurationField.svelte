<script lang="ts">
  import { onMount } from 'svelte';
  import { formatHms, parseHms } from '../lib/duration';

  // Edits a numeric value (seconds) as an hh:mm:ss text field. Blur/Enter
  // commits the parsed seconds back to the bound value.
  let { value = $bindable<number | undefined>(0), placeholder = 'mm:ss', id = '', touched = () => {} } = $props();

  let text = $state('');

  function refreshText() {
    const v = value ?? 0;
    text = v > 0 ? formatHms(v) : '';
  }

  function commit() {
    touched();
    const parsed = parseHms(text);
    if (!isNaN(parsed)) value = parsed;
    else refreshText();
  }

  onMount(refreshText);
  $effect(() => {
    if (text === '' && (value ?? 0) > 0) refreshText();
  });
</script>

<input
  {id}
  type="text"
  inputmode="numeric"
  {placeholder}
  bind:value={text}
  onkeydown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
  onblur={commit}
/>

<style>
  input {
    width: 100%;
    min-height: var(--tap);
    padding: 10px var(--space-3);
    border: none;
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  input:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent);
  }
</style>
