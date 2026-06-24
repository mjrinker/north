<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabase'
  import { goto } from '$app/navigation'

  let status = $state('Signing in…')

  onMount(async () => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    if (!code) {
      status = 'No authorization code found. Please try signing in again.'
      return
    }

    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        status = `Sign in failed: ${error.message}`
        return
      }
      goto('/', { replaceState: true })
    } catch (e: any) {
      status = `Sign in error: ${e.message}`
    }
  })
</script>

<div class="page">
  <p>{status}</p>
  {#if status !== 'Signing in…'}
    <button class="btn" onclick={() => goto('/')}>Back to Home</button>
  {/if}
</div>

<style>
  .page { padding: 2rem; text-align: center; color: var(--text-primary, #222); }
  .btn {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--card-border, #ccc);
    border-radius: 6px;
    background: var(--accent, #0066cc);
    color: white;
    cursor: pointer;
    font-size: 0.85rem;
  }
</style>
