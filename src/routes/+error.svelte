<script lang="ts">
  import { page } from '$app/stores';
  let status = $state(500);
  let errorInfo = $state<{ message: string; stack?: string } | null>(null);
  page.subscribe(p => {
    status = p.status;
    errorInfo = p.error ? { message: p.error.message, stack: (p.error as any).stack } : null;
    try {
      const KEY = '__logs';
      const MAX = 500;
      let buf: Record<string, unknown>[] = [];
      try { buf = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}
      buf.push({ t: Date.now(), l: 'error', m: `[+error.svelte] Route error: status ${p.status}${p.error?.message ? ', ' + p.error.message : ''}`, u: window.location.href });
      if (buf.length > MAX) buf = buf.slice(buf.length - MAX);
      localStorage.setItem(KEY, JSON.stringify(buf));
    } catch {}
  });

  let copied = $state(false);
  async function copyError() {
    if (!errorInfo) return;
    const text = `Error: ${errorInfo.message}${errorInfo.stack ? '\n\nStack:\n' + errorInfo.stack : ''}`;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch {}
  }
</script>

<div class="error-page">
  <h1>Something went wrong</h1>
  <p>The app encountered an unexpected error (status {status}).</p>
  {#if typeof window !== 'undefined'}
    <div class="error-links">
      <button onclick={() => window.location.reload()}>Reload</button>
      {#if errorInfo}
        <button class="debug-link" onclick={copyError}>{copied ? 'Copied!' : 'Copy error stack'}</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 2rem;
    text-align: center;
    color: var(--text-primary, #222);
  }
  h1 { margin-bottom: 0.5rem; }
  p { margin-bottom: 1.5rem; color: var(--text-secondary, #555); }
  .error-links { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; justify-content: center; }
  button, .debug-link {
    padding: 0.5rem 1.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    background: var(--accent, #0066cc);
    color: white;
    cursor: pointer;
    font-size: 1rem;
    text-decoration: none;
  }
  .debug-link {
    background: transparent;
    color: var(--text-primary, #222);
  }
  .debug-link:hover { background: var(--btn-secondary-bg, #eee); }
</style>
