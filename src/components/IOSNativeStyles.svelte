<script lang="ts">
  import { onMount } from 'svelte';
  import { iosNativeEnabled } from '../stores/platform';

  onMount(() => {
    const unsubscribe = iosNativeEnabled.subscribe((enabled) => {
      if (enabled) {
        document.documentElement.classList.add('ios-native');
        document.body.classList.add('ios-native');
      } else {
        document.documentElement.classList.remove('ios-native');
        document.body.classList.remove('ios-native');
      }
    });
    return unsubscribe;
  });
</script>

<svelte:head>
  <link rel="stylesheet" href="/styles/ios-native.css" />
</svelte:head>