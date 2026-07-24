<script lang="ts">
  import { onMount } from 'svelte';

  let { children }: { children: import('svelte').Snippet } = $props();

  let hasError = $state(false);
  let errorMessage = $state('');

  function lsLog(level: string, msg: string, stack?: string) {
    try {
      const KEY = '__logs';
      const MAX = 500;
      let buf: Record<string, unknown>[] = [];
      try { buf = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}
      buf.push({ t: Date.now(), l: level, m: msg.slice(0, 5000), s: stack ? stack.slice(0, 10000) : undefined, u: window.location.href });
      if (buf.length > MAX) buf = buf.slice(buf.length - MAX);
      localStorage.setItem(KEY, JSON.stringify(buf));
    } catch {}
  }

  function onGlobalError(e: ErrorEvent) {
    const err = e.error || e.message || 'Unknown error';
    const msg = typeof err === 'string' ? err : err.message || String(err);
    const stack = e.error?.stack;
    lsLog('error', '[ErrorBoundary] ' + msg, stack);
    hasError = true;
    errorMessage = msg;
    try { console.error('[ErrorBoundary] caught:', err); } catch {}
    e.preventDefault();
  }

  function onRejection(e: PromiseRejectionEvent) {
    const r = e.reason;
    const msg = r?.message || String(r || 'Unknown rejection');
    lsLog('error', '[ErrorBoundary] Unhandled rejection: ' + msg, r?.stack);
    hasError = true;
    errorMessage = msg;
    try { console.error('[ErrorBoundary] rejection:', msg); } catch {}
    e.preventDefault();
  }

  onMount(() => {
    window.addEventListener('error', onGlobalError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onGlobalError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  });
</script>

{#if hasError}
  <div class="error-boundary">
    <h1>Something went wrong</h1>
    <p class="error-msg">{errorMessage}</p>
    <div class="error-actions">
      <button class="btn-primary" onclick={() => window.location.reload()}>Reload app</button>
      <a href="/debug" class="btn-link">View debug logs</a>
    </div>
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .error-boundary {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 2rem;
    text-align: center;
    color: var(--text-primary, #222);
  }
  h1 { margin-bottom: 0.5rem; font-size: 1.5rem; }
  .error-msg {
    margin-bottom: 1.5rem;
    color: var(--text-secondary, #555);
    font-size: 0.9rem;
    max-width: 500px;
    word-break: break-word;
  }
  .error-actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; justify-content: center; }
  .btn-primary {
    padding: 0.5rem 1.5rem;
    border: none;
    border-radius: 6px;
    background: var(--accent, #0066cc);
    color: white;
    cursor: pointer;
    font-size: 1rem;
    text-decoration: none;
  }
  .btn-primary:hover { opacity: 0.9; }
  .btn-link {
    padding: 0.5rem 1.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    background: transparent;
    color: var(--text-primary, #222);
    cursor: pointer;
    font-size: 1rem;
    text-decoration: none;
  }
  .btn-link:hover { background: var(--btn-secondary-bg, #eee); }
</style>
