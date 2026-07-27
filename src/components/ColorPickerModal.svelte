<script lang="ts">
  let {
    title = 'Color',
    currentHex = '#0066cc',
    themeMode = 'light',
    showTabs = false,
    onConfirm,
    onClose,
  }: {
    title?: string;
    currentHex?: string;
    themeMode?: 'light' | 'dark';
    showTabs?: boolean;
    onConfirm: (hex: string, newMode: 'light' | 'dark') => void;
    onClose: () => void;
  } = $props();

  function parseColor(color: string): { r: number; g: number; b: number } | null {
    const hslMatch = color.trim().match(/^hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)$/);
    if (hslMatch) {
      const h$ = parseInt(hslMatch[1]) / 360;
      const s = parseInt(hslMatch[2]) / 100;
      const l = parseInt(hslMatch[3]) / 100;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + h$ * 12) % 12;
        return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      };
      return { r: f(0), g: f(8), b: f(4) };
    }
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16) / 255,
        g: parseInt(hex[1] + hex[1], 16) / 255,
        b: parseInt(hex[2] + hex[2], 16) / 255,
      };
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16) / 255,
        g: parseInt(hex.substring(2, 4), 16) / 255,
        b: parseInt(hex.substring(4, 6), 16) / 255,
      };
    }
    return null;
  }

  function hexToHsv(color: string): { h: number; s: number; v: number } {
    const rgb = parseColor(color);
    if (!rgb) return { h: 0, s: 0, v: 0.5 };
    let { r, g, b } = rgb;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h$ = 0;
    if (d !== 0) {
      switch (max) {
        case r: h$ = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h$ = ((b - r) / d + 2) / 6; break;
        case b: h$ = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h$ * 360), s: max === 0 ? 0 : d / max, v: max };
  }

  function hsvToHex(h: number, s: number, v: number): string {
    h /= 60;
    const c = v * s;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 1) { r = c; g = x; }
    else if (h < 2) { r = x; g = c; }
    else if (h < 3) { g = c; b = x; }
    else if (h < 4) { g = x; b = c; }
    else if (h < 5) { r = x; b = c; }
    else { r = c; b = x; }
    const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

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

  function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const hsv = hexToHsv(hex);
    const l = hsv.v * (1 - hsv.s / 2);
    const s = l === 0 || l === 1 ? 0 : (hsv.v - l) / Math.min(l, 1 - l);
    return { h: hsv.h, s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  let tab = $state<'circles' | 'spectrum'>('circles');
  let selectedHex = $state(currentHex);

  let { h: initH, s: initS, v: initV } = hexToHsv(currentHex);
  let hue = $state(initH);
  let sat = $state(initS);
  let val = $state(initV);

  let detectedMode = $state(themeMode);
  let scrollEl = $state<HTMLElement | null>(null);
  let fieldEl = $state<HTMLElement | null>(null);
  let hueBarEl = $state<HTMLElement | null>(null);

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
      arr.push(hslToHex(h, s, l));
    }
    return arr;
  });

  let scales: number[] = $state(new Array(palette.length).fill(0.5));
  let zIndexes: number[] = $state(new Array(palette.length).fill(50));

  $effect(() => {
    if (tab === 'circles') {
      selectedHex = palette[Math.round((hue / 360) * palette.length) % palette.length];
    }
  });

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
    const col = hexToHsv(selectedHex);
    hue = col.h;
    sat = col.s;
    val = col.v;
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

  function pickFromField(clientX: number, clientY: number) {
    if (!fieldEl) return;
    const rect = fieldEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    sat = x;
    val = 1 - y;
    selectedHex = hsvToHex(hue, sat, val);
    const hsl = hexToHsl(selectedHex);
    detectedMode = hsl.l > 50 ? 'light' : 'dark';
  }

  function pickFromHueBar(clientX: number) {
    if (!hueBarEl) return;
    const rect = hueBarEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    hue = Math.round(x * 360);
    selectedHex = hsvToHex(hue, sat, val);
    const hsl = hexToHsl(selectedHex);
    detectedMode = hsl.l > 50 ? 'light' : 'dark';
  }

  let draggingField = false;
  let draggingHue = false;

  function onFieldDown(e: PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingField = true;
    pickFromField(e.clientX, e.clientY);
  }

  function onFieldMove(e: PointerEvent) {
    if (!draggingField) return;
    pickFromField(e.clientX, e.clientY);
  }

  function onFieldUp(e: PointerEvent) {
    draggingField = false;
  }

  function onHueDown(e: PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingHue = true;
    pickFromHueBar(e.clientX);
  }

  function onHueMove(e: PointerEvent) {
    if (!draggingHue) return;
    pickFromHueBar(e.clientX);
  }

  function onHueUp() {
    draggingHue = false;
  }

  function handleConfirm() {
    onConfirm(selectedHex, detectedMode);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={onClose}>
  <div class="picker" onclick={(e) => e.stopPropagation()}>
    <div class="header">
      <h2>{title}</h2>
      <button class="close-btn" onclick={onClose} aria-label="Close">&times;</button>
    </div>

    {#if showTabs}
      <div class="tabs">
        <button class="tab" class:active={tab === 'circles'} onclick={() => tab = 'circles'}>Circles</button>
        <button class="tab" class:active={tab === 'spectrum'} onclick={() => tab = 'spectrum'}>Spectrum</button>
      </div>
    {/if}

    {#if tab === 'circles'}
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
      <div class="spectrum-area">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="color-field"
          bind:this={fieldEl}
          style="background-color: hsl({hue}, 100%, 50%); touch-action: none;"
          onpointerdown={onFieldDown}
          onpointermove={onFieldMove}
          onpointerup={onFieldUp}
          onpointercancel={onFieldUp}
        >
          <div class="field-white"></div>
          <div class="field-black"></div>
          <div class="selector" style="left: {sat * 100}%; top: {(1 - val) * 100}%;">
            <div class="selector-inner" style="background: {selectedHex};"></div>
          </div>
        </div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="hue-bar"
          bind:this={hueBarEl}
          style="touch-action: none;"
          onpointerdown={onHueDown}
          onpointermove={onHueMove}
          onpointerup={onHueUp}
          onpointercancel={onHueUp}
        >
          <div class="hue-track"></div>
          <div class="hue-thumb" style="left: {(hue / 360) * 100}%;"></div>
        </div>
      </div>
    {/if}

    <div class="preview-row">
      <div class="preview-swatch" style="background: {selectedHex};"></div>
      <span class="preview-hex">{selectedHex.toUpperCase()}</span>
      {#if showTabs}
        <span class="mode-tag" class:light={detectedMode === 'light'}>{detectedMode === 'light' ? 'Light mode' : 'Dark mode'}</span>
      {/if}
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

  .tabs {
    display: flex;
    gap: 0;
    padding: 0.75rem 1.25rem 0;
  }

  .tab {
    flex: 1;
    padding: 0.4rem 0;
    border: none;
    background: none;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary, #888);
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }

  .tab.active {
    color: var(--accent, #0066cc);
    border-bottom-color: var(--accent, #0066cc);
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
  }

  .spectrum-area {
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .color-field {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    cursor: crosshair;
  }

  .field-white {
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, #fff, transparent);
    pointer-events: none;
  }

  .field-black {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, #000, transparent);
    pointer-events: none;
  }

  .selector {
    position: absolute;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 5;
    box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2);
  }

  .selector-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }

  .hue-bar {
    position: relative;
    width: 100%;
    height: 28px;
    cursor: pointer;
    touch-action: none;
  }

  .hue-track {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: linear-gradient(to right,
      hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%), hsl(90,100%,50%),
      hsl(120,100%,50%), hsl(150,100%,50%), hsl(180,100%,50%), hsl(210,100%,50%),
      hsl(240,100%,50%), hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%), hsl(360,100%,50%)
    );
  }

  .hue-thumb {
    position: absolute;
    top: 50%;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transform: translate(-50%, -50%);
    pointer-events: none;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    border: 1px solid rgba(0,0,0,0.1);
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

  .mode-tag {
    margin-left: auto;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
  }

  .mode-tag.light {
    background: var(--btn-secondary-bg, #eee);
    color: var(--text-primary, #222);
  }

  .mode-tag:not(.light) {
    background: #333;
    color: #ddd;
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
