import { Platform } from 'react-native';

import {
  getNativeStoredItem,
  removeNativeStoredItem,
  setNativeStoredItem,
} from '@/lib/native-key-value-storage';

export type AppRole = 'student' | 'invigilator' | 'admin';

export type StoredSessionProfile = {
  departmentName: string | null;
  fullName: string;
  id: string;
  institutionalId: string | null;
  role: AppRole;
};

const SESSION_PROFILE_STORAGE_KEY = 'chetect.session-profile';

function normalizeStoredSessionProfile(value: unknown): StoredSessionProfile | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<Record<keyof StoredSessionProfile, unknown>>;
  const id = String(candidate.id ?? '').trim();
  const fullName = String(candidate.fullName ?? '').trim();
  const role = String(candidate.role ?? '').trim();

  if (!id || !fullName || !['student', 'invigilator', 'admin'].includes(role)) {
    return null;
  }

  return {
    departmentName:
      typeof candidate.departmentName === 'string' ? candidate.departmentName : null,
    fullName,
    id,
    institutionalId:
      typeof candidate.institutionalId === 'string' ? candidate.institutionalId : null,
    role: role as AppRole,
  };
}

async function readStoredValue() {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(SESSION_PROFILE_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  try {
    return await getNativeStoredItem(SESSION_PROFILE_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function writeStoredValue(value: string) {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(SESSION_PROFILE_STORAGE_KEY, value);
    } catch {
      // Ignore storage write failures in restricted browser contexts.
    }
    return;
  }

  try {
    await setNativeStoredItem(SESSION_PROFILE_STORAGE_KEY, value);
  } catch {
    // Ignore best effort storage write failures.
  }
}

export async function readStoredSessionProfile() {
  const storedValue = await readStoredValue();
  if (!storedValue) {
    return null;
  }

  try {
    return normalizeStoredSessionProfile(JSON.parse(storedValue));
  } catch {
    return null;
  }
}

export async function writeStoredSessionProfile(profile: StoredSessionProfile) {
  await writeStoredValue(JSON.stringify(profile));
}

export async function clearStoredSessionProfile() {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(SESSION_PROFILE_STORAGE_KEY);
    } catch {
      // Ignore storage delete failures in restricted browser contexts.
    }
    return;
  }

  try {
    await removeNativeStoredItem(SESSION_PROFILE_STORAGE_KEY);
  } catch {
    // Ignore best effort storage delete failures.
  }
}
