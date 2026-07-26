<script lang="ts">
  let {
    mode = 'circles',
    currentHex = '#0066cc',
    themeMode = 'light',
    onConfirm,
    onClose,
  }: {
    mode?: 'circles' | 'spectrum';
    currentHex?: string;
    themeMode?: 'light' | 'dark';
    onConfirm: (hex: string, newMode: 'light' | 'dark') => void;
    onClose: () => void;
  } = $props();

  let selectedHex = $state(currentHex);
  let detectedMode = $state(themeMode);
  let scrollEl = $state<HTMLElement | null>(null);

  const CIRCLE_D = 48;
  const OVERLAP = 22;
  const SPACING = CIRCLE_D - OVERLAP;

  let palette: string[] = $derived.by(() => {
    const isLight = detectedMode === 'light';
    const l = isLight ? 60 : 35;
    const s = 72;
    const count = 120;
    const arr: string[] = [];
    for (let i = 0; i < count; i++) {
      const h = Math.round((i / count) * 360);
      arr.push(`hsl(${h}, ${s}%, ${l}%)`);
    }
    return arr;
  });

  let scales: number[] = $state(new Array(palette.length).fill(0.5));
  let zIndexes: number[] = $state(new Array(palette.length).fill(50));

  function generateSpectrumColors(): { hex: string; light: boolean }[] {
    const colors: { hex: string; light: boolean }[] = [];
    const s = 75;
    const lightnesses = [88, 75, 62, 48, 35, 22];
    const hueSteps = 15;
    for (const l of lightnesses) {
      for (let hi = 0; hi < hueSteps; hi++) {
        const h = Math.round((hi / hueSteps) * 360);
        const hex = hslToHex(h, s, l);
        colors.push({ hex, light: l > 50 });
      }
    }
    return colors;
  }

  let spectrumColors = $derived(generateSpectrumColors());

  function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  let rafId = $state(0);

  function handleScroll() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updateTransforms);
  }

  function updateTransforms() {
    rafId = 0;
    if (!scrollEl) return;
    const containerCenter = scrollEl.scrollLeft + scrollEl.clientWidth / 2;
    const padLeft = parseFloat(getComputedStyle(scrollEl).paddingLeft) || 0;
    const firstCenter = padLeft + CIRCLE_D / 2;

    for (let i = 0; i < palette.length; i++) {
      const cx = firstCenter + i * SPACING;
      const dist = Math.abs(cx - containerCenter);
      const t = Math.min(dist / (scrollEl.clientWidth * 0.55), 1);
      const scale = 0.3 + 0.7 * Math.pow(Math.cos(t * Math.PI / 2), 0.6);
      scales[i] = scale;
      zIndexes[i] = Math.round(scale * 100);
    }

    const idx = Math.round((containerCenter - firstCenter) / SPACING);
    const ci = Math.max(0, Math.min(palette.length - 1, idx));
    selectedHex = palette[ci];
  }

  let snapTimer: ReturnType<typeof setTimeout> | null = null;

  function onScrollEnd() {
    if (snapTimer) clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      if (!scrollEl) return;
      const containerCenter = scrollEl.scrollLeft + scrollEl.clientWidth / 2;
      const padLeft = parseFloat(getComputedStyle(scrollEl).paddingLeft) || 0;
      const firstCenter = padLeft + CIRCLE_D / 2;
      const idx = Math.round((containerCenter - firstCenter) / SPACING);
      const ci = Math.max(0, Math.min(palette.length - 1, idx));
      const targetLeft = ci * SPACING + firstCenter - CIRCLE_D / 2 - scrollEl.clientWidth / 2 + CIRCLE_D / 2;
      scrollEl.scrollTo({ left: targetLeft, behavior: 'smooth' });
    }, 150);
  }

  function selectSpectrumColor(hex: string) {
    selectedHex = hex;
    const hsl = hexToHsl(hex);
    detectedMode = hsl.l > 50 ? 'light' : 'dark';
  }

  function hexToHsl(hex: string): { h: number; s: number; l: number } {
    let r = 0, g = 0, b = 0;
    const h = hex.replace('#', '');
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
    } else if (h.length >= 6) {
      r = parseInt(h.substring(0, 2), 16);
      g = parseInt(h.substring(2, 4), 16);
      b = parseInt(h.substring(4, 6), 16);
    }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h$ = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h$ = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h$ = ((b - r) / d + 2) / 6; break;
        case b: h$ = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h$ * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function handleConfirm() {
    onConfirm(selectedHex, detectedMode);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={onClose}>
  <div class="picker" onclick={(e) => e.stopPropagation()}>
    <div class="header">
      <h2>{mode === 'circles' ? 'Accent Color' : 'Main Color'}</h2>
      <button class="close-btn" onclick={onClose} aria-label="Close">&times;</button>
    </div>

    {#if mode === 'circles'}
      <div class="circles-area">
        <div
          class="scroll-container"
          bind:this={scrollEl}
          onscroll={handleScroll}
          ontouchend={onScrollEnd}
          onpointerup={onScrollEnd}
        >
          {#each palette as hex, i}
            <div class="circle-wrap" style="z-index: {zIndexes[i]}">
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <div
                class="circle"
                style="background: {hex}; transform: scale({scales[i]});"
              ></div>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="spectrum-grid">
        {#each spectrumColors as sc, i}
          <button
            class="spec-swatch"
            style="background: {sc.hex}; transform: scale({selectedHex === sc.hex ? 1.15 : 1});"
            onclick={() => selectSpectrumColor(sc.hex)}
            aria-label={sc.hex}
          ></button>
        {/each}
      </div>
      <p class="mode-hint">{detectedMode === 'light' ? 'Light mode' : 'Dark mode'}</p>
    {/if}

    <div class="preview-row">
      <div class="preview-swatch" style="background: {selectedHex};"></div>
      <span class="preview-hex">{selectedHex.toUpperCase()}</span>
    </div>

    <div class="actions">
      <button class="btn btn-cancel" onclick={onClose}>Cancel</button>
      <button class="btn btn-ok" onclick={handleConfirm}>OK</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .picker {
    background: var(--card-bg, #fff);
    border-radius: 14px;
    width: 88vw;
    max-width: 380px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.25);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem 0;
  }

  .header h2 {
    font-size: 1.1rem;
    color: var(--text-primary, #222);
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--text-secondary, #999);
    cursor: pointer;
    line-height: 1;
    padding: 0.25rem;
  }

  .circles-area {
    padding: 1.5rem 0;
    overflow: hidden;
  }

  .scroll-container {
    display: flex;
    overflow-x: auto;
    scroll-behavior: auto;
    padding: 0 calc(50% - 24px);
    align-items: center;
    height: 90px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .scroll-container::-webkit-scrollbar {
    display: none;
  }

  .circle-wrap {
    flex-shrink: 0;
    width: 48px;
    margin-left: -22px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .circle-wrap:first-child {
    margin-left: 0;
  }

  .circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    flex-shrink: 0;
    will-change: transform;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    transition: box-shadow 0.15s;
  }

  .spectrum-grid {
    display: grid;
    grid-template-columns: repeat(15, 1fr);
    gap: 4px;
    padding: 1rem 1.25rem;
  }

  .spec-swatch {
    aspect-ratio: 1;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: transform 0.1s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }

  .spec-swatch:hover {
    transform: scale(1.2);
  }

  .mode-hint {
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
    margin: -0.25rem 0 0.5rem;
  }

  .preview-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
  }

  .preview-swatch {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid var(--card-border, #ddd);
    flex-shrink: 0;
  }

  .preview-hex {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary, #222);
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem 1.25rem;
    justify-content: flex-end;
  }

  .btn {
    padding: 0.5rem 1.25rem;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
  }

  .btn-cancel {
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
  }

  .btn-ok {
    background: var(--accent, #0066cc);
    color: var(--accent-text, #fff);
  }
</style>
