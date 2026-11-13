import { useSyncExternalStore } from 'react';

// A tiny hash router. Hash URLs need no server rewrites, so the same build
// works on Cloudflare, inside the Android app and when opened offline.
//
// Every entry we push remembers how deep it is in history.state, so "back"
// knows whether there is an in-app page to return to — also after the
// browser's own back and forward buttons have been used.

function current(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/';
}

function depth(): number {
  const s = window.history.state as { idx?: unknown } | null;
  return s && typeof s.idx === 'number' ? s.idx : 0;
}

const listeners = new Set<() => void>();
const scrollByDepth = new Map<number, number>();
let restoreTo = 0;

function emit(): void {
  for (const l of listeners) l();
}

function onPop(): void {
  // Arriving through back/forward: return to where the reader was.
  restoreTo = scrollByDepth.get(depth()) ?? 0;
  emit();
}

function subscribe(cb: () => void): () => void {
  if (!listeners.size) {
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', emit);
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (!listeners.size) {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', emit);
    }
  };
}

export function go(path: string): void {
  if (path === current()) return;
  scrollByDepth.set(depth(), window.scrollY);
  restoreTo = 0;
  window.history.pushState({ idx: depth() + 1 }, '', `#${path}`);
  emit();
}

export function replace(path: string): void {
  restoreTo = 0;
  window.history.replaceState({ idx: depth() }, '', `#${path}`);
  emit();
}

/** Goes back if we came from inside the app, otherwise to a sensible parent. */
export function back(fallback = '/'): void {
  if (depth() > 0) window.history.back();
  else replace(fallback);
}

/** Scroll position the current screen should start at. */
export function scrollTarget(): number {
  return restoreTo;
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, current);
}
