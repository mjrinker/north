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
    const text = `Error: ${decodeURIComponent(errorInfo.message)}${errorInfo.stack ? '\n\nStack:\n' + decodeURIComponent(errorInfo.stack) : ''}`;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch {}
  }
</script>

<div class="error-page">
  {#if status === 404}
    <h1>Page not found</h1>
    <p>That page doesn’t exist.</p>
  {:else}
    <h1>Something went wrong</h1>
    <p>North hit an unexpected error ({status}).</p>
  {/if}
  {#if typeof window !== 'undefined'}
    <div class="error-links">
      {#if status === 404}
        <a class="btn" href="/today">Go to Today</a>
      {:else}
        <button class="btn" onclick={() => window.location.reload()}>Reload</button>
      {/if}
      {#if errorInfo && status !== 404}
        <button class="btn btn-plain" onclick={copyError}>{copied ? 'Copied' : 'Copy error details'}</button>
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
    padding: var(--space-6) var(--gutter);
    text-align: center;
  }

  h1 {
    font-size: var(--text-lg);
    margin-bottom: var(--space-2);
  }

  p {
    margin-bottom: var(--space-5);
    color: var(--text-2);
  }

  .error-links {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
</style>
