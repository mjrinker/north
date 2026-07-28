<script lang="ts">
  import { generateIconSvg } from '../lib/icon';

  let {
    mainColor = '#1a1a2e',
    accentColor = '#0066cc',
  }: {
    mainColor?: string;
    accentColor?: string;
  } = $props();

  let html = $derived(generateIconSvg(mainColor, accentColor));
</script>

{@html html}
