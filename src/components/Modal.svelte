<script lang="ts">
  import { onMount } from 'svelte';

  // Bottom sheet on phones, centered dialog on wider screens. Form controls
  // inside get the shared field styling below so every modal looks alike.
  let { onClose, children, wide = false }: { onClose: () => void; children?: import('svelte').Snippet; wide?: boolean } = $props();

  let sheet = $state<HTMLDivElement | null>(null);

  onMount(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheet?.focus();
    return () => { document.body.style.overflow = prev; };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scrim" onclick={onClose}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="sheet" class:wide bind:this={sheet} role="dialog" aria-modal="true" tabindex="-1"
    onclick={e => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}>
    <div class="grabber" aria-hidden="true"></div>
    {@render children?.()}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: var(--scrim);
    animation: fade 0.2s ease;
  }

  .sheet {
    position: relative;
    width: 100%;
    max-height: calc(100dvh - env(safe-area-inset-top) - 24px);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--space-2) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom));
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--bg);
    box-shadow: var(--shadow-sheet);
    animation: rise 0.28s var(--ease);
    outline: none;
  }

  .grabber {
    width: 36px;
    height: 5px;
    margin: 0 auto var(--space-3);
    border-radius: 3px;
    background: var(--surface-3);
  }

  @media (min-width: 640px) {
    .scrim {
      align-items: center;
      padding: var(--space-5);
    }

    .sheet {
      max-width: 520px;
      max-height: min(86dvh, 860px);
      padding: var(--space-5);
      border-radius: var(--radius-lg);
      animation: pop 0.2s var(--ease);
    }

    .sheet.wide {
      max-width: 720px;
    }

    .grabber {
      display: none;
    }
  }

  @keyframes fade { from { opacity: 0; } }
  @keyframes rise { from { transform: translateY(40%); opacity: 0.4; } }
  @keyframes pop { from { transform: scale(0.97); opacity: 0; } }

  /* Shared content styling for every modal. Zero specificity (:where) so a
     component's own styles always win. */
  :global(:where(.sheet h2)) {
    font-size: var(--text-lg);
    font-weight: 650;
    margin: 0 0 var(--space-4);
    color: var(--text);
  }

  :global(:where(.sheet label)) {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-2);
  }

  :global(:where(.sheet input:not([type='checkbox']):not([type='radio']):not([type='color']):not([type='range']))),
  :global(:where(.sheet select)),
  :global(:where(.sheet textarea)) {
    width: 100%;
    min-height: var(--tap);
    padding: 10px var(--space-3);
    border: none;
    border-radius: var(--radius);
    background-color: var(--surface);
    color: var(--text);
    font-family: var(--font);
    font-size: 16px;
    appearance: none;
    -webkit-appearance: none;
  }

  :global(:where(.sheet select)) {
    padding-right: 36px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none' stroke='%23908d89' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
  }

  :global(:where(.sheet textarea)) {
    min-height: 88px;
    line-height: 1.45;
    resize: vertical;
  }

  :global(:where(.sheet input:focus)),
  :global(:where(.sheet select:focus)),
  :global(:where(.sheet textarea:focus)) {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent);
  }

  :global(:where(.sheet input[type='checkbox']:not(.switch))),
  :global(:where(.sheet input[type='radio'])) {
    accent-color: var(--accent);
    width: 18px;
    height: 18px;
  }
</style>
