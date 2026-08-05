import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, radius, shadow, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useSession } from '@/providers/session-provider';
import { supabase } from '@/lib/supabase';

const HIGH_RISK_NOTIFICATION_TYPE = 'suspicious_event_high_risk';
const TOAST_VISIBLE_MS = 7000;
const MAX_TOASTS = 3;

type NotificationToastRow = {
  body?: string;
  created_at?: string;
  data?: Record<string, unknown> | null;
  id: string;
  notification_type?: string;
  title?: string;
  user_id?: string;
};

type AlertToast = {
  body: string;
  createdAt: string;
  examId: string | null;
  id: string;
  title: string;
};

function normalizeNotificationToast(row: NotificationToastRow): AlertToast {
  const data = row.data ?? {};
  const examId = typeof data.examId === 'string' && data.examId.trim() ? data.examId.trim() : null;

  return {
    body: String(row.body ?? '').trim() || 'A high-risk suspicious activity was detected.',
    createdAt: String(row.created_at ?? ''),
    examId,
    id: row.id,
    title: String(row.title ?? '').trim() || 'Suspicious activity alert',
  };
}

export function InvigilatorAlertToasts() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading, profile, role } = useSession();
  const [toasts, setToasts] = useState<AlertToast[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismissToast = useCallback((toastId: string) => {
    const timer = timersRef.current[toastId];
    if (timer) {
      clearTimeout(timer);
      delete timersRef.current[toastId];
    }

    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (
      isLoading ||
      !isAuthenticated ||
      !profile?.id ||
      (role !== 'invigilator' && role !== 'admin')
    ) {
      setToasts([]);
      return undefined;
    }

    const channel = supabase
      .channel(`invigilator-alert-toasts-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          filter: `user_id=eq.${profile.id}`,
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const notification = payload.new as NotificationToastRow;
          if (notification.notification_type !== HIGH_RISK_NOTIFICATION_TYPE) {
            return;
          }

          const toast = normalizeNotificationToast(notification);

          setToasts((current) => [
            toast,
            ...current.filter((item) => item.id !== toast.id),
          ].slice(0, MAX_TOASTS));

          const existingTimer = timersRef.current[toast.id];
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          timersRef.current[toast.id] = setTimeout(() => {
            dismissToast(toast.id);
          }, TOAST_VISIBLE_MS);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dismissToast, isAuthenticated, isLoading, profile?.id, role]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={[styles.toastLayer, { top: insets.top + 12 }]}>
      {toasts.map((toast) => (
        <Pressable
          key={toast.id}
          onPress={() => {
            dismissToast(toast.id);
            if (toast.examId) {
              router.push({
                pathname: '/(invigilator-tabs)/monitor',
                params: { examId: toast.examId },
              });
              return;
            }

            router.push('/(invigilator-tabs)/notifications');
          }}
          style={({ pressed }) => [styles.toastCard, pressed ? styles.toastPressed : null]}>
          <View style={styles.toastIcon}>
            <Feather color={colors.danger} name="alert-triangle" size={18} />
          </View>
          <View style={styles.toastText}>
            <Text numberOfLines={1} style={styles.toastTitle}>{toast.title}</Text>
            <Text numberOfLines={2} style={styles.toastBody}>{toast.body}</Text>
          </View>
          <Pressable hitSlop={10} onPress={() => dismissToast(toast.id)} style={styles.closeButton}>
            <Feather color={colors.mutedStrong} name="x" size={15} />
          </Pressable>
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    closeButton: {
      alignItems: 'center',
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    toastBody: {
      color: colors.mutedStrong,
      fontSize: type.body,
      lineHeight: 19,
      marginTop: 3,
    },
    toastCard: {
      alignItems: 'flex-start',
      backgroundColor: colors.panelRaised,
      borderColor: colors.borderStrong,
      borderLeftColor: colors.danger,
      borderLeftWidth: 3,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      ...shadow.raised,
    },
    toastIcon: {
      alignItems: 'center',
      backgroundColor: colors.dangerSoft,
      borderRadius: radius.pill,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    toastLayer: {
      gap: 10,
      left: layout.screenPaddingWide,
      maxWidth: layout.maxWidth,
      position: 'absolute',
      right: layout.screenPaddingWide,
      zIndex: 1000,
    },
    toastPressed: {
      opacity: 0.94,
      transform: [{ scale: 0.99 }],
    },
    toastText: {
      flex: 1,
    },
    toastTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
  });
}
