<script lang="ts">
  let {
    title = 'Color',
    currentHex = '#2b62c9',
    themeMode = 'light',
    pickerType = 'main',
    onConfirm,
    onClose,
  }: {
    title?: string;
    currentHex?: string;
    themeMode?: 'light' | 'dark';
    pickerType?: 'accent' | 'main';
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

  function colorToHex(color: string): string | null {
    const rgb = parseColor(color);
    if (!rgb) return null;
    const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const hsv = hexToHsv(hex);
    const l = hsv.v * (1 - hsv.s / 2);
    const s = l === 0 || l === 1 ? 0 : (hsv.v - l) / Math.min(l, 1 - l);
    return { h: hsv.h, s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  let scrollEl = $state<HTMLElement | null>(null);
  let fieldEl = $state<HTMLElement | null>(null);
  let hueBarEl = $state<HTMLElement | null>(null);

  const CIRCLE_D = 48;
  const OVERLAP = 22;
  const SPACING = CIRCLE_D - OVERLAP;

  let detectedMode = $state(themeMode);

  function buildRainbowPalette(s: number, l: number): string[] {
    const arr: string[] = [];
    for (let i = 0; i < 120; i++) {
      arr.push(hslToHex(Math.round((i / 120) * 360), s, l));
    }
    return arr;
  }

  function buildMainPalette(light: boolean): string[] {
    const count = 100;
    const arr: string[] = [];
    const s = light ? 42 : 52;
    for (let i = 0; i < count; i++) {
      const h = Math.round((i / count) * 360);
      const l = light ? (i % 2 === 0 ? 90 : 82) : (i % 2 === 0 ? 18 : 28);
      arr.push(hslToHex(h, s, l));
    }
    for (let g = 0; g < 20; g++) {
      arr.push(hslToHex(0, 0, light ? 95 - g * 1.5 : 5 + g * 1.5));
    }
    return arr;
  }

  const allPaletteColors = $derived(pickerType === 'accent' ? buildRainbowPalette(72, 55) : [...buildMainPalette(true), ...buildMainPalette(false)]);

  const palette = $derived(pickerType === 'accent' ? buildRainbowPalette(72, 55) : buildMainPalette(detectedMode === 'light'));

  let initialHex = $derived(colorToHex(currentHex) ?? currentHex.toLowerCase());
  let tab = $state<'circles' | 'spectrum'>('circles');
  let initialScrollDone = $state(false);

  $effect(() => {
    if (!allPaletteColors.includes(initialHex)) tab = 'spectrum';
  });

  $effect(() => {
    if (tab === 'circles') {
      if (!initialScrollDone) {
        const matchIdx = palette.findIndex(h => h === initialHex);
        requestAnimationFrame(() => {
          if (!scrollEl) return;
          if (matchIdx !== -1) {
            selectedHex = palette[matchIdx];
            const padLeft = parseFloat(getComputedStyle(scrollEl).paddingLeft) || 0;
            const firstCenter = padLeft + CIRCLE_D / 2;
            const targetLeft = firstCenter + matchIdx * SPACING - scrollEl.clientWidth / 2;
            scrollEl.scrollLeft = Math.max(0, targetLeft);
          }
          updateTransforms();
        });
        initialScrollDone = true;
      } else {
        requestAnimationFrame(() => {
          if (!scrollEl) return;
          updateTransforms();
        });
      }
    }
  });
  let selectedHex = $state(currentHex);

  let { h: initH, s: initS, v: initV } = hexToHsv(currentHex);
  let hue = $state(initH);
  let sat = $state(initS);
  let val = $state(initV);

  let scales: number[] = $state(new Array(palette.length).fill(0.5));
  let zIndexes: number[] = $state(new Array(palette.length).fill(50));

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
    if (pickerType === 'main') {
      const hsl = hexToHsl(selectedHex);
      detectedMode = hsl.l > 50 ? 'light' : 'dark';
    }
  }

  function pickFromHueBar(clientX: number) {
    if (!hueBarEl) return;
    const rect = hueBarEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    hue = Math.round(x * 360);
    selectedHex = hsvToHex(hue, sat, val);
    if (pickerType === 'main') {
      const hsl = hexToHsl(selectedHex);
      detectedMode = hsl.l > 50 ? 'light' : 'dark';
    }
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

    <div class="segmented tabs">
      <button class:active={tab === 'circles'} onclick={() => tab = 'circles'}>Suggested</button>
      <button class:active={tab === 'spectrum'} onclick={() => tab = 'spectrum'}>Custom</button>
    </div>

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
      {#if pickerType === 'main'}
        <span class="mode-tag" class:light={detectedMode === 'light'}>{detectedMode === 'light' ? 'Switches to light' : 'Switches to dark'}</span>
      {/if}
    </div>

    <div class="actions">
      <button class="btn btn-secondary" onclick={onClose}>Cancel</button>
      <button class="btn" onclick={handleConfirm}>Done</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: var(--scrim);
  }

  .picker {
    width: 100%;
    max-height: 90dvh;
    overflow-y: auto;
    padding-bottom: env(safe-area-inset-bottom);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--bg);
    box-shadow: var(--shadow-sheet);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-4) 0;
  }

  .header h2 {
    font-size: var(--text-md);
    font-weight: 650;
    margin: 0;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--text-2);
    font-size: 20px;
    line-height: 1;
  }

  .tabs {
    margin: var(--space-3) var(--space-4) 0;
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
    box-shadow: 0 0 0 2px var(--bg);
  }

  .spectrum-area {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .color-field {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: var(--radius);
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
    gap: var(--space-3);
    margin: 0 var(--space-4);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .preview-swatch {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.15);
  }

  .preview-hex {
    font-size: var(--text-base);
    font-weight: 500;
    font-family: var(--font-mono);
  }

  .mode-tag {
    margin-left: auto;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-2);
  }



  .actions {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-4);
    justify-content: flex-end;
  }



  .actions .btn {
    min-width: 96px;
  }

  @media (min-width: 640px) {
    .overlay { align-items: center; }
    .picker { max-width: 400px; border-radius: var(--radius-lg); }
  }
</style>
