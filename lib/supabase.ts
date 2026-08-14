import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import {
  getNativeStoredItem,
  removeNativeStoredItem,
  setNativeStoredItem,
} from '@/lib/native-key-value-storage';

const rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!rawSupabaseUrl) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL environment variable.');
}

if (!supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable.');
}

const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/i, '');

function getFetchUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

const contextualFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (error) {
    const url = getFetchUrl(input);
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return url;
      }
    })();
    throw new Error(
      `Supabase network request failed (${host}): ${
        error instanceof Error ? error.message : 'Network request failed.'
      }`
    );
  }
};

const authStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }

    return getNativeStoredItem(key);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // Ignore storage access failures in restricted browser contexts.
      }
      return;
    }

    await removeNativeStoredItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        // Ignore storage access failures in restricted browser contexts.
      }
      return;
    }

    await setNativeStoredItem(key, value);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true,
    storage: authStorage,
    storageKey: 'chetect.supabase.auth',
  },
  global: {
    fetch: contextualFetch,
  },
});
