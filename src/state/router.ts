import { useSyncExternalStore } from 'react';

// A tiny hash router. Hash URLs need no server rewrites, so the same build
// works on Cloudflare, inside the Android app and when opened offline.
function current(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/';
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

let depth = 0;

export function go(path: string): void {
  if (path === current()) return;
  depth++;
  window.location.hash = path;
}

export function replace(path: string): void {
  const url = new URL(window.location.href);
  url.hash = path;
  window.history.replaceState(null, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Goes back if we came from inside the app, otherwise to a sensible parent. */
export function back(fallback = '/'): void {
  if (depth > 0) {
    depth--;
    window.history.back();
  } else replace(fallback);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, current);
}

export const TABS = ['/', '/list', '/calendar', '/stats'] as const;
