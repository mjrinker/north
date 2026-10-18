import { writable, derived } from 'svelte/store';
import { userFeatures } from './roles';

export const isIOS = writable(false);
export const isAndroid = writable(false);

function detectPlatform() {
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;
    isIOS.set(/iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream);
    isAndroid.set(/Android/.test(ua));
  }
}

if (typeof window !== 'undefined') {
  detectPlatform();
}

export const iosNativeEnabled = derived(
  [userFeatures, isIOS],
  ([$userFeatures, $isIOS]) => $isIOS && $userFeatures.includes('IOS_NATIVE_UI'),
);
