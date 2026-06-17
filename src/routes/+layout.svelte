<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children }: { children: Snippet } = $props();
</script>

<nav style="padding: 1rem; background: #f5f5f5;">
  <a href="/" style="margin-right: 1rem;">Home</a>
  <a href="/habits">Habits</a>
</nav>

{@render children()}