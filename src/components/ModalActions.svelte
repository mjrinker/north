<script lang="ts">
  let {
    onSave,
    onCancel,
    onDelete,
    saveType = 'button',
    saveLabel = 'Save',
    deleteLabel = 'Delete',
  }: {
    onSave?: () => void;
    onCancel: () => void;
    onDelete?: () => void;
    saveType?: 'button' | 'submit';
    saveLabel?: string;
    deleteLabel?: string;
  } = $props();
</script>

<div class="actions">
  {#if onDelete}
    <button type="button" onclick={onDelete} class="btn btn-plain delete">{deleteLabel}</button>
  {/if}
  <div class="actions-right">
    <button type="button" onclick={onCancel} class="btn btn-secondary">Cancel</button>
    <button type={saveType} onclick={onSave} class="btn">{saveLabel}</button>
  </div>
</div>

<style>
  /* Sticks to the bottom of the sheet while the form scrolls. */
  .actions {
    position: sticky;
    bottom: calc(-1 * (var(--space-4) + env(safe-area-inset-bottom)));
    z-index: 2;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-5) calc(-1 * var(--space-4)) calc(-1 * (var(--space-4) + env(safe-area-inset-bottom)));
    padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 0.5px solid var(--separator);
  }

  .actions-right {
    display: flex;
    gap: var(--space-2);
    margin-left: auto;
  }

  .actions-right .btn {
    min-width: 96px;
  }

  .delete {
    color: var(--danger);
    padding-left: 0;
  }

  @media (min-width: 640px) {
    .actions {
      bottom: calc(-1 * var(--space-5));
      margin: var(--space-5) calc(-1 * var(--space-5)) calc(-1 * var(--space-5));
      padding: var(--space-3) var(--space-5);
    }
  }
</style>
