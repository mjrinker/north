<script lang="ts">
  import Icon from '@iconify/svelte';

  let {
    onSave,
    onCancel,
    onDelete,
    saveType = 'button',
    saveLabel = 'Save',
  }: {
    onSave?: () => void;
    onCancel: () => void;
    onDelete?: () => void;
    saveType?: 'button' | 'submit';
    saveLabel?: string;
  } = $props();
</script>

<div class="actions">
  {#if onDelete}
    <button onclick={onDelete} class="icon-btn danger" aria-label="Delete"><Icon icon="mdi:delete" style="color: inherit" /></button>
  {:else}
    <div></div>
  {/if}
  <div class="actions-right">
    <button type={saveType} onclick={onSave} class="icon-btn save" aria-label={saveLabel}><Icon icon="mdi:check" style="color: inherit" /></button>
    <button onclick={onCancel} class="icon-btn cancel" aria-label="Cancel"><Icon icon="mdi:close" style="color: inherit" /></button>
  </div>
</div>

<style>
  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.75rem;
  }
  .actions-right {
    display: flex;
    gap: 0.75rem;
  }
  .icon-btn {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-sizing: border-box;
  }
  .icon-btn :global(svg), .icon-btn :global(.iconify) { font-size: 1.6rem; color: inherit; }
  .icon-btn.save { background: var(--btn-secondary-bg, #eee); color: var(--text-primary, #222); }
  .icon-btn.danger { background: #d32f2f; color: white; }
  .icon-btn.cancel { background: var(--btn-secondary-bg, #eee); color: var(--text-primary, #222); }
  .icon-btn:hover { opacity: 0.85; }
</style>
