import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { clearNativeStoredItems } from '@/lib/native-key-value-storage';
import { supabase } from '@/lib/supabase';

function toDirectoryChildUri(rootUri: string, entryName: string) {
  return `${rootUri.endsWith('/') ? rootUri : `${rootUri}/`}${entryName}`;
}

async function clearDirectoryContents(rootUri: string | null | undefined) {
  const normalizedRootUri = String(rootUri ?? '').trim();
  if (!normalizedRootUri) {
    return;
  }

  try {
    const entries = await FileSystem.readDirectoryAsync(normalizedRootUri);
    await Promise.all(
      entries.map((entryName) =>
        FileSystem.deleteAsync(toDirectoryChildUri(normalizedRootUri, entryName), {
          idempotent: true,
        }).catch(() => undefined)
      )
    );
  } catch {
    // Best effort cleanup for app-private filesystem data.
  }
}

async function clearWebStorage() {
  try {
    globalThis.localStorage?.clear();
  } catch {
    // Ignore storage access failures in restricted browser contexts.
  }

  try {
    globalThis.sessionStorage?.clear();
  } catch {
    // Ignore storage access failures in restricted browser contexts.
  }

  try {
    const cacheStorage = (globalThis as typeof globalThis & { caches?: CacheStorage }).caches;
    if (!cacheStorage) {
      return;
    }

    const cacheKeys = await cacheStorage.keys();
    await Promise.all(cacheKeys.map((cacheKey) => cacheStorage.delete(cacheKey)));
  } catch {
    // Cache storage is not guaranteed to exist in every browser/runtime.
  }
}

async function clearIndexedDbDatabases() {
  try {
    const indexedDb = (globalThis as typeof globalThis & {
      indexedDB?: IDBFactory & {
        databases?: () => Promise<Array<{ name?: string | null }>>;
      };
    }).indexedDB;

    if (!indexedDb?.databases) {
      return;
    }

    const databases = await indexedDb.databases();
    const databaseNames = [
      ...new Set(databases.map((database) => String(database.name ?? '').trim()).filter(Boolean)),
    ];

    await Promise.all(
      databaseNames.map(
        (databaseName) =>
          new Promise<void>((resolve) => {
            try {
              const request = indexedDb.deleteDatabase(databaseName);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            } catch {
              resolve();
            }
          })
      )
    );
  } catch {
    // IndexedDB cleanup is browser-dependent, so keep it best effort.
  }
}

async function clearNativeStorage() {
  try {
    await clearNativeStoredItems();
  } catch {
    // Ignore best effort storage cleanup failures.
  }

  await Promise.all([
    clearDirectoryContents(FileSystem.cacheDirectory),
    clearDirectoryContents(FileSystem.documentDirectory),
  ]);
}

export async function clearLocalAppData() {
  if (Platform.OS === 'web') {
    await Promise.all([clearWebStorage(), clearIndexedDbDatabases()]);
    return;
  }

  await clearNativeStorage();
}

export async function signOutAndClearLocalData() {
  const { error } = await supabase.auth.signOut({
    scope: 'local',
  });

  await supabase.removeAllChannels().catch(() => undefined);
  await clearLocalAppData();

  if (error) {
    throw error;
  }
}
