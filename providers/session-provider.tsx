import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { signOutAndClearLocalData } from '@/lib/local-app-data';
import {
  clearStoredSessionProfile,
  readStoredSessionProfile,
  type AppRole,
  type StoredSessionProfile,
  writeStoredSessionProfile,
} from '@/lib/session-profile-storage';
import { supabase } from '@/lib/supabase';

type SessionProfileRow = {
  department_name: string | null;
  full_name: string;
  id: string;
  institutional_id: string | null;
  role: AppRole;
};

export type SessionProfile = StoredSessionProfile;

type SessionContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  profile: SessionProfile | null;
  refreshProfile: () => Promise<void>;
  role: AppRole | null;
  session: Session | null;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function normalizeRole(value: unknown): AppRole | null {
  const role = String(value ?? '').trim();
  if (role === 'student' || role === 'invigilator' || role === 'admin') {
    return role;
  }

  return null;
}

function deriveSessionProfileFromSession(nextSession: Session): SessionProfile | null {
  const role = normalizeRole(
    nextSession.user.app_metadata?.role ?? nextSession.user.user_metadata?.role
  );

  if (!role) {
    return null;
  }

  const metadata = nextSession.user.user_metadata ?? {};
  const fullName =
    String(metadata.full_name ?? metadata.name ?? nextSession.user.email ?? '')
      .trim() || 'User';

  return {
    departmentName:
      typeof metadata.department_name === 'string' ? metadata.department_name : null,
    fullName,
    id: nextSession.user.id,
    institutionalId:
      typeof metadata.institutional_id === 'string' ? metadata.institutional_id : null,
    role,
  };
}

async function fetchSessionProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, institutional_id, department_name, role')
    .eq('id', userId)
    .maybeSingle<SessionProfileRow>();

  if (error) {
    throw new Error(`Unable to restore your profile: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    departmentName: data.department_name,
    fullName: data.full_name,
    id: data.id,
    institutionalId: data.institutional_id,
    role: data.role,
  } satisfies SessionProfile;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const sessionRef = useRef<Session | null>(null);
  const profileRef = useRef<SessionProfile | null>(null);
  const syncRequestRef = useRef(0);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const syncSession = useCallback(async (nextSession: Session | null, showLoader: boolean) => {
    const requestId = syncRequestRef.current + 1;
    syncRequestRef.current = requestId;

    if (showLoader) {
      setIsLoading(true);
    }

    if (!nextSession?.user) {
      setSession(null);
      setProfile(null);
      void clearStoredSessionProfile();
      setIsLoading(false);
      return;
    }

    setSession(nextSession);

    const activeUserId = nextSession.user.id;
    const cachedProfile = await readStoredSessionProfile();
    const provisionalProfile = deriveSessionProfileFromSession(nextSession);

    if (syncRequestRef.current !== requestId) {
      return;
    }

    if (cachedProfile?.id === activeUserId) {
      setProfile(cachedProfile);
    } else if (provisionalProfile?.id === activeUserId) {
      setProfile(provisionalProfile);
    } else if (profileRef.current?.id !== activeUserId) {
      setProfile(null);
    }

    try {
      const nextProfile = await fetchSessionProfile(activeUserId);

      if (syncRequestRef.current !== requestId) {
        return;
      }

      if (!nextProfile) {
        await clearStoredSessionProfile();
        await signOutAndClearLocalData();
        setSession(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setProfile(nextProfile);
      await writeStoredSessionProfile(nextProfile);
    } catch {
      if (syncRequestRef.current !== requestId) {
        return;
      }

      // Keep the active auth session instead of forcing a logout on a transient
      // profile refresh failure during app reload or network recovery.
      if (
        cachedProfile?.id !== activeUserId &&
        provisionalProfile?.id !== activeUserId &&
        profileRef.current?.id !== activeUserId
      ) {
        setProfile(null);
      }
    } finally {
      if (syncRequestRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return;
      }

      const currentUserId = sessionRef.current?.user.id ?? null;
      const nextUserId = nextSession?.user.id ?? null;
      const shouldShowLoader =
        event === 'INITIAL_SESSION' ||
        currentUserId !== nextUserId ||
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'USER_UPDATED';

      void syncSession(nextSession, shouldShowLoader);
    });

    supabase.auth.startAutoRefresh();

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        supabase.auth.startAutoRefresh();
        return;
      }

      supabase.auth.stopAutoRefresh();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      appStateSubscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, [syncSession]);

  const refreshProfile = useCallback(async () => {
    if (!sessionRef.current?.user.id) {
      return;
    }

    const refreshedProfile = await fetchSessionProfile(sessionRef.current.user.id);
    setProfile(refreshedProfile);

    if (refreshedProfile) {
      await writeStoredSessionProfile(refreshedProfile);
      return;
    }

    await clearStoredSessionProfile();
  }, []);

  const signOut = useCallback(async () => {
    await signOutAndClearLocalData();
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(session && profile),
      isLoading,
      profile,
      refreshProfile,
      role: profile?.role ?? null,
      session,
      signOut,
    }),
    [isLoading, profile, refreshProfile, session, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error('useSession must be used within a SessionProvider.');
  }

  return value;
}
