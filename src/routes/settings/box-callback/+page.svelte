<script lang="ts">
  import { onMount } from 'svelte'
  import { exchangeCodeForTokens, setBoxTokens, clearBoxTokens } from '$lib/box'
  import { goto } from '$app/navigation'

  let status = $state('Exchanging authorization code…')

  onMount(async () => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    if (error) {
      status = `Authorization denied: ${error}`
      return
    }

    if (!code) {
      status = 'No authorization code received.'
      return
    }

    const userId = sessionStorage.getItem('box_user_id') || state

    try {
      const tokens = await exchangeCodeForTokens(code)
      await setBoxTokens(userId, tokens)
      sessionStorage.removeItem('box_code_verifier')
      sessionStorage.removeItem('box_user_id')
      goto('/settings')
    } catch (e: any) {
      status = `Failed to connect Box: ${e.message}`
      await clearBoxTokens(userId)
    }
  })
</script>

<div class="page">
  <p>{status}</p>
</div>

<style>
  .page { padding: 2rem; text-align: center; color: var(--text-primary, #222); }
</style>
