export const DEFAULT_CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutes

export const CACHE_KEYS = {
  SITE_SETTINGS: 'dr_cache_site_settings_v1',
  PUBLIC_PROPERTIES: 'dr_cache_public_properties_v1',
  VISIBLE_TEAM: 'dr_cache_visible_team_v1',
  APPROVED_REVIEWS: 'dr_cache_approved_reviews_v1',
} as const;

export function ownerDashboardCacheKey(userId: string): string {
  return `dr_cache_owner_dashboard_v1_${userId}`;
}

export function clientDashboardCacheKey(userId: string): string {
  return `dr_cache_client_dashboard_v1_${userId}`;
}

export function userPreferencesCacheKey(userId: string): string {
  return `dr_cache_user_prefs_v1_${userId}`;
}

interface CacheEnvelope<T> {
  value: T;
  savedAt: number;
}

export interface CacheReadResult<T> {
  value: T;
  isFresh: boolean;
  savedAt: number;
}

const memoryCache = new Map<string, CacheEnvelope<unknown>>();

function getSafeStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function readCache<T>(
  key: string,
  ttlMs: number = DEFAULT_CACHE_TTL_MS,
  now: number = Date.now(),
  storage?: Storage
): CacheReadResult<T> | null {
  if (!storage) {
    const memHit = memoryCache.get(key);
    if (memHit) {
      const age = now - memHit.savedAt;
      return {
        value: memHit.value as T,
        isFresh: age >= 0 && age < ttlMs,
        savedAt: memHit.savedAt,
      };
    }
  }

  const store = getSafeStorage(storage);
  if (!store) return null;

  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheEnvelope<T>>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.savedAt !== 'number' ||
      !('value' in parsed)
    ) {
      return null;
    }

    if (!storage) {
      memoryCache.set(key, { value: parsed.value, savedAt: parsed.savedAt });
    }

    const age = now - parsed.savedAt;
    return {
      value: parsed.value as T,
      isFresh: age >= 0 && age < ttlMs,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function writeCache<T>(
  key: string,
  value: T,
  now: number = Date.now(),
  storage?: Storage
): void {
  const payload: CacheEnvelope<T> = { value, savedAt: now };
  if (!storage) {
    memoryCache.set(key, payload);
  }

  const store = getSafeStorage(storage);
  if (!store) return;

  try {
    store.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore storage quota or privacy mode errors
  }
}

export function removeCacheKeys(keys: readonly string[], storage?: Storage): void {
  if (!storage) {
    for (const key of keys) {
      memoryCache.delete(key);
    }
  }

  const store = getSafeStorage(storage);
  if (!store) return;

  for (const key of keys) {
    try {
      store.removeItem(key);
    } catch {
      // ignore storage errors
    }
  }
}

export function invalidateCacheByPrefix(prefix: string, storage?: Storage): void {
  if (!storage) {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
  }

  const store = getSafeStorage(storage);
  if (!store) return;

  try {
    const toRemove: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i);
      if (k && k.startsWith(prefix)) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) {
      store.removeItem(k);
    }
  } catch {
    // ignore storage errors
  }
}

export function invalidatePublicCaches(storage?: Storage): void {
  removeCacheKeys(
    [
      CACHE_KEYS.SITE_SETTINGS,
      CACHE_KEYS.PUBLIC_PROPERTIES,
      CACHE_KEYS.VISIBLE_TEAM,
      CACHE_KEYS.APPROVED_REVIEWS,
    ],
    storage
  );
}

export function invalidateDashboardCaches(storage?: Storage): void {
  invalidateCacheByPrefix('dr_cache_owner_dashboard_v1_', storage);
  invalidateCacheByPrefix('dr_cache_client_dashboard_v1_', storage);
  invalidateCacheByPrefix('dr_cache_user_prefs_v1_', storage);
}
