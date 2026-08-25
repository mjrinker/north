<script lang="ts">
  import { onMount } from 'svelte';
  import { iosNativeEnabled } from '../stores/platform';
  import { get } from 'svelte/store';

  onMount(() => {
    // Ensure clean initial state
    if (!get(iosNativeEnabled)) {
      document.documentElement.classList.remove('ios-native');
      document.body.classList.remove('ios-native');
    }
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