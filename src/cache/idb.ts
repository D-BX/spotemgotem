// Thin IndexedDB wrapper (via idb-keyval) for caching API metadata only.
// Never used for audio. Entries are namespaced and carry a timestamp so a TTL
// policy can be added later if needed.

import { createStore, get, set, del } from 'idb-keyval';
import type { UseStore } from 'idb-keyval';

const store: UseStore = createStore('spotemgotem-cache', 'metadata');

interface CacheEntry<T> {
  value: T;
  savedAt: number;
}

export async function readCache<T>(key: string): Promise<T | undefined> {
  const entry = await get<CacheEntry<T>>(key, store);
  return entry?.value;
}

export function writeCache<T>(key: string, value: T): Promise<void> {
  const entry: CacheEntry<T> = { value, savedAt: Date.now() };
  return set(key, entry, store);
}

export function clearCacheKey(key: string): Promise<void> {
  return del(key, store);
}
