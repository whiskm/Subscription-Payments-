import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;

export const isIOS =
  /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isAndroid = /Android/.test(ua);

/** Running as an installed app (home-screen PWA or native), not in a browser tab. */
export function isStandalone(): boolean {
  if (isNative) return true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/** The File System Access API lets us keep overwriting one chosen backup file (desktop Chromium). */
export const canLinkFile = !isNative && typeof window !== 'undefined' && 'showSaveFilePicker' in window;
