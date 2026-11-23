import assert from 'node:assert/strict';
import test from 'node:test';
import type { NavigateFunction } from 'react-router-dom';
import {
  canGoBackSafely,
  goBackOrFallback,
  navigateWithTransition,
  recordNavigationEntry,
} from './motion.ts';

function withMockBrowser(
  initial: { idx?: number; pathname: string; search?: string },
  fn: () => void
) {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const mockWindow = {
    history: {
      state:
        typeof initial.idx === 'number' ? { idx: initial.idx } : null,
    },
    location: {
      pathname: initial.pathname,
      search: initial.search ?? '',
    },
    matchMedia: () => ({ matches: false }),
  };

  (globalThis as { window?: unknown }).window = mockWindow;
  try {
    fn();
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  }
}

test('canGoBackSafely returns false when history index is missing or 0', () => {
  withMockBrowser({ idx: 0, pathname: '/properties' }, () => {
    recordNavigationEntry('/properties');
    assert.equal(canGoBackSafely(), false);
  });

  withMockBrowser({ pathname: '/privacy-policy' }, () => {
    assert.equal(canGoBackSafely(), false);
  });
});

test('canGoBackSafely respects skipPathPrefixes and duplicate routes', () => {
  withMockBrowser({ idx: 0, pathname: '/' }, () => {
    recordNavigationEntry('/');
  });

  withMockBrowser({ idx: 1, pathname: '/owner-dashboard' }, () => {
    recordNavigationEntry('/owner-dashboard');
    assert.equal(canGoBackSafely(['/owner-dashboard']), true);
  });

  withMockBrowser({ idx: 2, pathname: '/owner-dashboard', search: '?tab=properties' }, () => {
    recordNavigationEntry('/owner-dashboard?tab=properties');
    assert.equal(canGoBackSafely(['/owner-dashboard']), false);
    assert.equal(canGoBackSafely(['/properties']), true);
  });
});

test('goBackOrFallback uses -1 when safe history exists and fallbackTo otherwise', () => {
  const calls: Array<string | number> = [];
  const navigate = ((to: string | number) => {
    calls.push(to);
  }) as unknown as NavigateFunction;

  withMockBrowser({ idx: 0, pathname: '/properties/sample-villa' }, () => {
    recordNavigationEntry('/properties/sample-villa');
    goBackOrFallback(navigate, '/properties', {
      skipPathPrefixes: ['/properties/sample-villa'],
    });
  });
  assert.deepEqual(calls, ['/properties']);

  calls.length = 0;

  withMockBrowser({ idx: 0, pathname: '/properties', search: '?type=Buy' }, () => {
    recordNavigationEntry('/properties?type=Buy');
  });
  withMockBrowser({ idx: 1, pathname: '/properties/sample-villa' }, () => {
    recordNavigationEntry('/properties/sample-villa');
    goBackOrFallback(navigate, '/properties', {
      skipPathPrefixes: ['/properties/sample-villa'],
    });
  });
  assert.deepEqual(calls, [-1]);
});

test('navigateWithTransition dispatches numeric deltas directly to navigate', () => {
  const calls: Array<string | number> = [];
  const navigate = ((to: string | number) => {
    calls.push(to);
  }) as unknown as NavigateFunction;

  navigateWithTransition(navigate, -1);
  assert.deepEqual(calls, [-1]);
});
