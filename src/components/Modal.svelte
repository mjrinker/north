<script lang="ts">
  let { onClose, children }: { onClose: () => void; children?: import('svelte').Snippet } = $props();
</script>

<div class="modal-overlay" role="dialog" aria-modal="true" tabindex="-1" onclick={onClose} onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}>
  <div class="modal" onclick={e => e.stopPropagation()}>
    {@render children?.()}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal {
    background: var(--card-bg, #fff);
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
    max-height: 90vh;
    overflow-y: auto;
  }
</style>
