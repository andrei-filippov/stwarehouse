/**
 * Simple global query cache to prevent redundant Supabase fetches
 * Reduces egress usage by reusing recent data across component re-renders
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/** Default TTL: 2 minutes */
export const DEFAULT_CACHE_TTL_MS = 2 * 60 * 1000;

/** Get cached data if fresh enough */
export function getCached<T>(key: string, ttlMs = DEFAULT_CACHE_TTL_MS): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

/** Store data in cache */
export function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/** Invalidate a specific cache key */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/** Invalidate all keys matching a prefix */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/** Clear entire cache */
export function clearCache(): void {
  cache.clear();
}

/** Get cache stats for debugging */
export function getCacheStats(): { size: number; keys: string[] } {
  return { size: cache.size, keys: Array.from(cache.keys()) };
}
