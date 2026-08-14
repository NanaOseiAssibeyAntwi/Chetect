import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getCachedScreenData,
  isCachedScreenDataFresh,
  loadCachedScreenData,
  setCachedScreenData,
} from '@/lib/screen-cache';

type CachedResourceOptions<T> = {
  enabled?: boolean;
  initialData: T;
  key: string;
  loader: () => Promise<T>;
  maxAgeMs?: number;
};

type RefreshOptions = {
  force?: boolean;
  showLoader?: boolean;
};

const DEFAULT_MAX_AGE_MS = 45_000;

export function useCachedResource<T>({
  enabled = true,
  initialData,
  key,
  loader,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
}: CachedResourceOptions<T>) {
  const cached = useMemo(() => getCachedScreenData<T>(key)?.data, [key]);
  const [data, setDataState] = useState<T>(cached ?? initialData);
  const [isLoading, setIsLoading] = useState(enabled && cached === undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const nextCached = getCachedScreenData<T>(key)?.data;
    setDataState(nextCached ?? initialData);
    setIsLoading(enabled && nextCached === undefined);
    setErrorMessage('');
  }, [enabled, initialData, key]);

  const setData = useCallback(
    (nextData: T) => {
      setCachedScreenData(key, nextData);
      setDataState(nextData);
    },
    [key]
  );

  const refresh = useCallback(
    async ({ force = false, showLoader }: RefreshOptions = {}) => {
      if (!enabled) {
        setIsLoading(false);
        setIsRefreshing(false);
        return data;
      }

      const cachedEntry = getCachedScreenData<T>(key);
      if (cachedEntry?.data !== undefined) {
        setDataState(cachedEntry.data);
      }

      if (!force && isCachedScreenDataFresh(key, maxAgeMs)) {
        setIsLoading(false);
        setIsRefreshing(false);
        return cachedEntry?.data ?? data;
      }

      const hasUsableData = cachedEntry?.data !== undefined || data !== initialData;
      const shouldShowLoader = showLoader ?? !hasUsableData;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (shouldShowLoader) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setErrorMessage('');

      try {
        const result = await loadCachedScreenData({
          force,
          key,
          loader,
          maxAgeMs,
        });

        if (isMountedRef.current && requestIdRef.current === requestId) {
          setDataState(result);
        }

        return result;
      } catch (error) {
        if (isMountedRef.current && requestIdRef.current === requestId) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load this screen.');
        }
        return cachedEntry?.data ?? data;
      } finally {
        if (isMountedRef.current && requestIdRef.current === requestId) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [data, enabled, initialData, key, loader, maxAgeMs]
  );

  return {
    data,
    errorMessage,
    isLoading,
    isRefreshing,
    refresh,
    setData,
  };
}
