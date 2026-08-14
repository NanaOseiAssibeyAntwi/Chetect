type CacheEntry<T> = {
  data?: T;
  promise?: Promise<T>;
  updatedAt: number;
};

const screenCache = new Map<string, CacheEntry<unknown>>();

export function getCachedScreenData<T>(key: string) {
  return screenCache.get(key) as CacheEntry<T> | undefined;
}

export function setCachedScreenData<T>(key: string, data: T) {
  screenCache.set(key, {
    data,
    updatedAt: Date.now(),
  });
}

export function isCachedScreenDataFresh(key: string, maxAgeMs: number) {
  const cached = screenCache.get(key);
  return Boolean(cached?.data !== undefined && Date.now() - cached.updatedAt < maxAgeMs);
}

export async function loadCachedScreenData<T>({
  force = false,
  key,
  loader,
  maxAgeMs,
}: {
  force?: boolean;
  key: string;
  loader: () => Promise<T>;
  maxAgeMs: number;
}) {
  const cached = getCachedScreenData<T>(key);

  if (!force && cached?.data !== undefined && Date.now() - cached.updatedAt < maxAgeMs) {
    return cached.data;
  }

  if (!force && cached?.promise) {
    return cached.promise;
  }

  const promise = loader().then((data) => {
    setCachedScreenData(key, data);
    return data;
  });

  screenCache.set(key, {
    data: cached?.data as T,
    promise,
    updatedAt: cached?.updatedAt ?? 0,
  });

  try {
    return await promise;
  } finally {
    const nextCached = getCachedScreenData<T>(key);
    if (nextCached?.promise === promise) {
      screenCache.set(key, {
        data: nextCached.data,
        updatedAt: nextCached.updatedAt,
      });
    }
  }
}

export function clearScreenCache(key: string) {
  screenCache.delete(key);
}

export function clearScreenCacheByPrefix(prefix: string) {
  for (const key of screenCache.keys()) {
    if (key.startsWith(prefix)) {
      screenCache.delete(key);
    }
  }
}

export function clearAllScreenCache() {
  screenCache.clear();
}
