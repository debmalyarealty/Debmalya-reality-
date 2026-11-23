import type { NavigateFunction } from 'react-router-dom';
import { flushSync } from 'react-dom';

export const LUX_EASE = [0.22, 1, 0.36, 1] as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Lightweight passive touch/click ripple across buttons, links, cards, chips, and icon buttons.
 * Uses a fixed pointer-events-none overlay clipped to the target's bounding box so layout and
 * stacking contexts on existing elements are never altered.
 */
export function initGlobalTapFeedback(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onPointerDown = (e: PointerEvent) => {
    if (prefersReducedMotion()) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(
      'button:not(:disabled), a[href], [role="button"], .tap-press'
    );
    if (!target) return;
    if (target.dataset.noRipple === '1') return;

    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const cs = getComputedStyle(target);
    const host = document.createElement('span');
    host.setAttribute('aria-hidden', 'true');
    host.style.position = 'fixed';
    host.style.left = `${rect.left}px`;
    host.style.top = `${rect.top}px`;
    host.style.width = `${rect.width}px`;
    host.style.height = `${rect.height}px`;
    host.style.borderRadius = cs.borderRadius || '0px';
    host.style.overflow = 'hidden';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '9997';

    const localX =
      e.clientX > 0 ? e.clientX - rect.left : rect.width / 2;
    const localY =
      e.clientY > 0 ? e.clientY - rect.top : rect.height / 2;
    const diameter = Math.max(rect.width, rect.height) * 2.1;

    const dot = document.createElement('span');
    dot.className = 'lux-ripple-dot';
    dot.style.left = `${localX}px`;
    dot.style.top = `${localY}px`;
    dot.style.width = `${diameter}px`;
    dot.style.height = `${diameter}px`;

    host.appendChild(dot);
    document.body.appendChild(host);

    window.setTimeout(() => {
      host.remove();
    }, 460);
  };

  document.addEventListener('pointerdown', onPointerDown, { passive: true });
  return () => {
    document.removeEventListener('pointerdown', onPointerDown);
  };
}

const ROUTE_HISTORY_STORAGE_KEY = 'dr_route_history_idx';
const routeHistoryByIdx = new Map<number, string>();

function hydrateHistoryFromSession(): void {
  if (typeof window === 'undefined' || routeHistoryByIdx.size > 0) return;
  try {
    const raw = window.sessionStorage?.getItem(ROUTE_HISTORY_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(parsed)) {
      const idx = Number(k);
      if (Number.isFinite(idx) && typeof v === 'string') {
        routeHistoryByIdx.set(idx, v);
      }
    }
  } catch {
    // ignore storage errors
  }
}

function persistHistoryToSession(): void {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, string> = {};
    for (const [k, v] of routeHistoryByIdx.entries()) {
      obj[String(k)] = v;
    }
    window.sessionStorage?.setItem(
      ROUTE_HISTORY_STORAGE_KEY,
      JSON.stringify(obj)
    );
  } catch {
    // ignore storage errors
  }
}

export function recordNavigationEntry(fullPath: string): void {
  if (typeof window === 'undefined') return;
  hydrateHistoryFromSession();
  const state = window.history.state as { idx?: number } | null;
  const idx = typeof state?.idx === 'number' ? state.idx : 0;
  routeHistoryByIdx.set(idx, fullPath);
  persistHistoryToSession();
}

function getCurrentFullPath(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname}${window.location.search}`;
}

export function canGoBackSafely(skipPathPrefixes: string[] = []): boolean {
  if (typeof window === 'undefined') return false;
  hydrateHistoryFromSession();
  const state = window.history.state as { idx?: number } | null;
  if (!state || typeof state.idx !== 'number' || state.idx <= 0) {
    return false;
  }

  const prevPath = routeHistoryByIdx.get(state.idx - 1);
  if (!prevPath) {
    return true;
  }

  const prevPathname = prevPath.split('?')[0].split('#')[0];
  if (prevPath === getCurrentFullPath()) {
    return false;
  }
  if (skipPathPrefixes.some((prefix) => prevPathname.startsWith(prefix))) {
    return false;
  }
  return true;
}

/**
 * Navigates cleanly using the browser View Transitions API when supported
 * (with reduced-motion check and instant fallback).
 * Numeric deltas (like -1) run directly because history traversal dispatches popstate asynchronously.
 */
export function navigateWithTransition(
  navigate: NavigateFunction,
  to: string | number
): void {
  if (typeof to === 'number') {
    navigate(to);
    return;
  }

  const run = () => {
    navigate(to);
  };

  if (typeof document === 'undefined' || prefersReducedMotion()) {
    run();
    return;
  }

  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };

  if (typeof doc.startViewTransition === 'function') {
    doc.startViewTransition(() => {
      flushSync(run);
    });
  } else {
    run();
  }
}

export function goBackOrFallback(
  navigate: NavigateFunction,
  fallbackTo: string = '/',
  options?: { skipPathPrefixes?: string[] }
): void {
  if (canGoBackSafely(options?.skipPathPrefixes)) {
    navigate(-1);
  } else {
    navigateWithTransition(navigate, fallbackTo);
  }
}
