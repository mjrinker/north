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

  let errorStack = $state<string | undefined>();

  function onGlobalError(e: ErrorEvent) {
    const err = e.error || e.message || 'Unknown error';
    const msg = typeof err === 'string' ? err : err.message || String(err);
    const stack = e.error?.stack;
    lsLog('error', msg, stack);
    hasError = true;
    errorMessage = msg;
    errorStack = stack;
    e.preventDefault();
  }

  function onRejection(e: PromiseRejectionEvent) {
    const r = e.reason;
    const msg = r?.message || String(r || 'Unknown rejection');
    lsLog('error', 'Unhandled rejection: ' + msg, r?.stack);
    hasError = true;
    errorMessage = msg;
    errorStack = r?.stack;
    e.preventDefault();
  }

  let copied = $state(false);
  async function copyError() {
    const text = `Error: ${decodeURIComponent(errorMessage)}${errorStack ? '\n\nStack:\n' + decodeURIComponent(errorStack) : ''}`;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch {}
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
      <button class="btn" onclick={() => window.location.reload()}>Reload</button>
      <button class="btn btn-plain" onclick={copyError}>{copied ? 'Copied' : 'Copy error details'}</button>
    </div>
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .error-boundary {
    max-width: 480px;
    margin: 0 auto;
    padding: 96px var(--gutter) var(--space-6);
    text-align: center;
  }

  h1 {
    font-size: var(--text-lg);
    margin-bottom: var(--space-2);
  }

  .error-msg {
    margin-bottom: var(--space-5);
    color: var(--text-2);
    font-size: var(--text-sm);
    word-break: break-word;
  }

  .error-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
</style>
