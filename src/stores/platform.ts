import { writable, derived } from 'svelte/store';
import { userRoles } from './roles';
import { userHasFeature } from '$lib/featureFlags';

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
  ([$userRoles, $isIOS]) => $isIOS && userHasFeature($userRoles, 'IOS_NATIVE_UI')
);