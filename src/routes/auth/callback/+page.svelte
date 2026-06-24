<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabase'
  import { goto } from '$app/navigation'

  let status = $state('Signing in…')

  onMount(async () => {
    const code = new URL(window.location.href).searchParams.get('code')
    if (!code) {
      status = 'No authorization code found.'
      return
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      status = `Sign in failed: ${error.message}`
      return
    }

    goto('/', { replaceState: true })
  })
</script>

<div class="page">
  <p>{status}</p>
</div>

<style>
  .page { padding: 2rem; text-align: center; color: var(--text-primary, #222); }
</style>
