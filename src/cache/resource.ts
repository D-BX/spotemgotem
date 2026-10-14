// Stale-while-revalidate resource primitive for SolidJS. On a key change it
// shows cached data from IndexedDB immediately (if any), then fetches fresh data
// in the background and updates both the UI and the cache. Within a single key,
// the cached->fresh swap replaces data in place to avoid layout shift.

import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import { readCache, writeCache } from './idb';

export interface CachedResource<T> {
  data: Accessor<T | undefined>;
  loading: Accessor<boolean>;
  error: Accessor<Error | null>;
  refetch: () => void;
}

export function createCachedResource<T>(
  key: Accessor<string | undefined>,
  fetcher: (key: string) => Promise<T>,
): CachedResource<T> {
  const [data, setData] = createSignal<T | undefined>();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);

  // Guards against races when the key changes or the component unmounts.
  let runId = 0;

  async function load(cacheKey: string): Promise<void> {
    const current = ++runId;
    setError(null);
    setLoading(true);

    try {
      const cached = await readCache<T>(cacheKey);
      if (cached !== undefined && current === runId) setData(() => cached);
    } catch {
      // A cache read failure is non-fatal; the network fetch still runs.
    }

    try {
      const fresh = await fetcher(cacheKey);
      if (current === runId) {
        setData(() => fresh);
        void writeCache(cacheKey, fresh);
      }
    } catch (e) {
      if (current === runId) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    } finally {
      if (current === runId) setLoading(false);
    }
  }

  createEffect(() => {
    const k = key();
    if (k === undefined) {
      setData(undefined);
      return;
    }
    setData(undefined);
    void load(k);
  });

  onCleanup(() => {
    runId++;
  });

  return {
    data,
    loading,
    error,
    refetch: () => {
      const k = key();
      if (k !== undefined) void load(k);
    },
  };
}
