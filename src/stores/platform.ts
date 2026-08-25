import { writable, derived } from 'svelte/store';
  import { userRoles } from './roles';
  import { getFeaturesForRoles } from '../types/auth';

  export const isIOS = writable(false);
  export const isAndroid = writable(false);

  function detectPlatform() {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      isIOS.set(/iPhone|iPad|iPod/.test(ua) && !window.MSStream);
      isAndroid.set(/Android/.test(ua));
    }
  }

  if (typeof window !== 'undefined') {
    detectPlatform();
  }

  export const iosNativeEnabled = derived(
    [userRoles, isIOS],
    ([$userRoles, $isIOS]) => {
      const features = getFeaturesForRoles($userRoles);
      const hasFeature = features.includes('IOS_NATIVE_UI' as any);
      console.log('[platform] roles:', $userRoles, 'isIOS:', $isIOS, 'features:', features, 'hasFeature:', hasFeature);
      return $isIOS && hasFeature;
    }
  );