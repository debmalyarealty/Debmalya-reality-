import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CACHE_KEYS,
  clientDashboardCacheKey,
  invalidateDashboardCaches,
  invalidatePublicCaches,
  ownerDashboardCacheKey,
  readCache,
  userPreferencesCacheKey,
  writeCache,
} from './localCache.ts';

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

test('writeCache and readCache preserve freshness within TTL and mark expired after TTL', () => {
  const storage = createMemoryStorage();
  const baseTime = 1_700_000_000_000;

  writeCache(CACHE_KEYS.SITE_SETTINGS, { business_name: 'Debmalya Realty' }, baseTime, storage);

  const fresh = readCache<{ business_name: string }>(
    CACHE_KEYS.SITE_SETTINGS,
    4 * 60 * 1000,
    baseTime + 60_000,
    storage
  );
  assert.ok(fresh);
  assert.equal(fresh.isFresh, true);
  assert.equal(fresh.value.business_name, 'Debmalya Realty');

  const stale = readCache<{ business_name: string }>(
    CACHE_KEYS.SITE_SETTINGS,
    4 * 60 * 1000,
    baseTime + 5 * 60 * 1000,
    storage
  );
  assert.ok(stale);
  assert.equal(stale.isFresh, false);
  assert.equal(stale.value.business_name, 'Debmalya Realty');
});

test('readCache handles corrupt JSON safely', () => {
  const storage = createMemoryStorage();
  storage.setItem(CACHE_KEYS.PUBLIC_PROPERTIES, '{not-valid-json');
  assert.equal(readCache(CACHE_KEYS.PUBLIC_PROPERTIES, 1000, Date.now(), storage), null);
});

test('invalidatePublicCaches removes all public cache keys', () => {
  const storage = createMemoryStorage();
  writeCache(CACHE_KEYS.SITE_SETTINGS, { ok: 1 }, 1000, storage);
  writeCache(CACHE_KEYS.PUBLIC_PROPERTIES, [{ id: 'p1' }], 1000, storage);
  writeCache(CACHE_KEYS.VISIBLE_TEAM, [], 1000, storage);
  writeCache(CACHE_KEYS.APPROVED_REVIEWS, [], 1000, storage);

  invalidatePublicCaches(storage);

  assert.equal(readCache(CACHE_KEYS.SITE_SETTINGS, 60_000, 1001, storage), null);
  assert.equal(readCache(CACHE_KEYS.PUBLIC_PROPERTIES, 60_000, 1001, storage), null);
  assert.equal(readCache(CACHE_KEYS.VISIBLE_TEAM, 60_000, 1001, storage), null);
  assert.equal(readCache(CACHE_KEYS.APPROVED_REVIEWS, 60_000, 1001, storage), null);
});

test('invalidateDashboardCaches clears owner, client, and preference caches cleanly without affecting public caches', () => {
  const storage = createMemoryStorage();
  const ownerKey = ownerDashboardCacheKey('owner-1');
  const clientKey = clientDashboardCacheKey('client-2');
  const prefKey = userPreferencesCacheKey('client-2');

  writeCache(CACHE_KEYS.PUBLIC_PROPERTIES, [{ id: 'p1' }], 1000, storage);
  writeCache(ownerKey, { stats: { total: 3 } }, 1000, storage);
  writeCache(clientKey, { bookings: [] }, 1000, storage);
  writeCache(prefKey, { listing_type: 'Buy' }, 1000, storage);

  invalidateDashboardCaches(storage);

  assert.equal(readCache(ownerKey, 60_000, 1001, storage), null);
  assert.equal(readCache(clientKey, 60_000, 1001, storage), null);
  assert.equal(readCache(prefKey, 60_000, 1001, storage), null);
  assert.ok(readCache(CACHE_KEYS.PUBLIC_PROPERTIES, 60_000, 1001, storage));
});

test('default memory cache serves instant reads and respects invalidateDashboardCaches', () => {
  const ownerKey = ownerDashboardCacheKey('mem-owner');
  writeCache(ownerKey, { ready: true }, 5000);

  const hit = readCache<{ ready: boolean }>(ownerKey, 60_000, 5100);
  assert.ok(hit);
  assert.equal(hit.isFresh, true);
  assert.equal(hit.value.ready, true);

  invalidateDashboardCaches();
  assert.equal(readCache(ownerKey, 60_000, 5100), null);
});
