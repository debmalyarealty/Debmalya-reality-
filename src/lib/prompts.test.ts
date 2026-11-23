import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCoachmarkLayout,
  dashboardCoachmarkKey,
  hasShownDashboardCoachmark,
  hasShownSignInPrompt,
  isDisallowedPromptRoute,
  isLocalStorageAvailable,
  markDashboardCoachmarkShown,
  markSignInPromptShown,
} from './prompts';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function createBlockedStorage(): Storage {
  return {
    get length() {
      return 0;
    },
    clear() {
      throw new Error('Blocked');
    },
    getItem() {
      throw new Error('Blocked');
    },
    key() {
      return null;
    },
    removeItem() {
      throw new Error('Blocked');
    },
    setItem() {
      throw new Error('Blocked');
    },
  };
}

test('isLocalStorageAvailable detects blocked storage cleanly', () => {
  const mem = createMemoryStorage();
  const blocked = createBlockedStorage();
  assert.equal(isLocalStorageAvailable(mem), true);
  assert.equal(isLocalStorageAvailable(blocked), false);
  assert.equal(isLocalStorageAvailable(null), false);
});

test('first-visit prompt shows once and skips silently when localStorage is blocked', () => {
  const mem = createMemoryStorage();
  assert.equal(hasShownSignInPrompt(mem), false);
  markSignInPromptShown(mem);
  assert.equal(hasShownSignInPrompt(mem), true);

  const blocked = createBlockedStorage();
  assert.equal(hasShownSignInPrompt(blocked), true);
  markSignInPromptShown(blocked);
});

test('dashboard coachmark is keyed per user id and skips blocked storage', () => {
  const mem = createMemoryStorage();
  assert.equal(dashboardCoachmarkKey('u1'), 'dashboardCoachmarkShown:u1');
  assert.equal(hasShownDashboardCoachmark('u1', mem), false);
  assert.equal(hasShownDashboardCoachmark('u2', mem), false);

  markDashboardCoachmarkShown('u1', mem);
  assert.equal(hasShownDashboardCoachmark('u1', mem), true);
  assert.equal(hasShownDashboardCoachmark('u2', mem), false);

  const blocked = createBlockedStorage();
  assert.equal(hasShownDashboardCoachmark('u1', blocked), true);
});

test('isDisallowedPromptRoute excludes dashboards and legal routes', () => {
  assert.equal(isDisallowedPromptRoute('/my-account'), true);
  assert.equal(isDisallowedPromptRoute('/owner-dashboard'), true);
  assert.equal(isDisallowedPromptRoute('/owner-login'), true);
  assert.equal(isDisallowedPromptRoute('/owner-login/dashboard'), true);
  assert.equal(isDisallowedPromptRoute('/privacy-policy'), true);
  assert.equal(isDisallowedPromptRoute('/terms'), true);
  assert.equal(isDisallowedPromptRoute('/disclaimer'), true);

  assert.equal(isDisallowedPromptRoute('/'), false);
  assert.equal(isDisallowedPromptRoute('/properties'), false);
  assert.equal(isDisallowedPromptRoute('/properties/flat-sevoke-road'), false);
});

test('computeCoachmarkLayout aligns arrow accurately at 320px, 390px, and 1440px', () => {
  // 320px mobile where dashboard icon sits at left=168..212 (center=190)
  const layout320 = computeCoachmarkLayout(
    { left: 168, top: 10, right: 212, bottom: 54, width: 44, height: 44 },
    320,
    640
  );
  assert.equal(layout320.anchorVisible, true);
  assert.equal(layout320.cardWidth, 304);
  assert.equal(layout320.cardLeft, 8);
  assert.equal(layout320.cardTop, 66);
  assert.equal(layout320.cardLeft + layout320.arrowLeftInCard, 190);

  // 1440px desktop where dashboard icon sits at center=1190
  const layout1440 = computeCoachmarkLayout(
    { left: 1168, top: 12, right: 1212, bottom: 56, width: 44, height: 44 },
    1440,
    900
  );
  assert.equal(layout1440.anchorVisible, true);
  assert.equal(layout1440.cardWidth, 316);
  assert.equal(layout1440.cardLeft + layout1440.arrowLeftInCard, 1190);

  // Hidden icon returns anchorVisible=false
  const hiddenLayout = computeCoachmarkLayout(
    { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
    390,
    844
  );
  assert.equal(hiddenLayout.anchorVisible, false);
});
