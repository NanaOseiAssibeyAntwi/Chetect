import * as FileSystem from 'expo-file-system/legacy';

type NativeKeyValueMap = Record<string, string>;

const STORAGE_FILE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}chetect-key-value-store.json`
  : '';

let nativeStoreCache: NativeKeyValueMap | null = null;
let nativeStoreLoadPromise: Promise<NativeKeyValueMap> | null = null;
let nativeStoreWritePromise: Promise<void> = Promise.resolve();

function cloneStore(store: NativeKeyValueMap) {
  return { ...store };
}

function normalizeStore(value: unknown): NativeKeyValueMap {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<NativeKeyValueMap>(
    (store, [key, entryValue]) => {
      if (key && typeof entryValue === 'string') {
        store[key] = entryValue;
      }

      return store;
    },
    {}
  );
}

async function loadNativeStoreFromDisk(): Promise<NativeKeyValueMap> {
  if (!STORAGE_FILE_URI) {
    return {};
  }

  try {
    const info = await FileSystem.getInfoAsync(STORAGE_FILE_URI);
    if (!info.exists || info.isDirectory) {
      return {};
    }

    const raw = await FileSystem.readAsStringAsync(STORAGE_FILE_URI);
    if (!raw.trim()) {
      return {};
    }

    return normalizeStore(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function loadNativeStore(): Promise<NativeKeyValueMap> {
  if (nativeStoreCache) {
    return nativeStoreCache;
  }

  if (!nativeStoreLoadPromise) {
    nativeStoreLoadPromise = loadNativeStoreFromDisk().then((store) => {
      nativeStoreCache = store;
      nativeStoreLoadPromise = null;
      return store;
    });
  }

  return nativeStoreLoadPromise;
}

async function persistNativeStore(nextStore: NativeKeyValueMap) {
  nativeStoreCache = nextStore;

  if (!STORAGE_FILE_URI) {
    return;
  }

  const hasEntries = Object.keys(nextStore).length > 0;

  if (!hasEntries) {
    try {
      await FileSystem.deleteAsync(STORAGE_FILE_URI, {
        idempotent: true,
      });
    } catch {
      // Best effort cleanup if the persistence file is already gone.
    }
    return;
  }

  await FileSystem.writeAsStringAsync(STORAGE_FILE_URI, JSON.stringify(nextStore));
}

async function queueNativeStoreMutation(
  mutate: (store: NativeKeyValueMap) => NativeKeyValueMap | void
) {
  const run = async () => {
    const currentStore = cloneStore(await loadNativeStore());
    const maybeNextStore = mutate(currentStore);
    const nextStore = maybeNextStore ? maybeNextStore : currentStore;
    await persistNativeStore(nextStore);
  };

  nativeStoreWritePromise = nativeStoreWritePromise.then(run, run);
  return nativeStoreWritePromise;
}

export async function getNativeStoredItem(key: string) {
  await nativeStoreWritePromise;
  const store = await loadNativeStore();
  return store[key] ?? null;
}

export async function setNativeStoredItem(key: string, value: string) {
  await queueNativeStoreMutation((store) => {
    store[key] = value;
  });
}

export async function removeNativeStoredItem(key: string) {
  await queueNativeStoreMutation((store) => {
    delete store[key];
  });
}

export async function clearNativeStoredItems() {
  await queueNativeStoreMutation(() => ({}));
}
