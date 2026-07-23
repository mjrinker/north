<script lang="ts">
  import { page } from '$app/stores';
  let status = $state(500);
  page.subscribe(p => status = p.status);
</script>

<div class="error-page">
  <h1>Something went wrong</h1>
  <p>The app encountered an unexpected error (status {status}).</p>
  <button onclick={() => window.location.reload()}>Reload</button>
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
  button {
    padding: 0.5rem 1.5rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    background: var(--accent, #0066cc);
    color: white;
    cursor: pointer;
    font-size: 1rem;
  }
</style>
