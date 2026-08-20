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
  eventId: string | null;
  id: string;
  source: 'event' | 'notification';
  title: string;
};

type SuspiciousEventToastRow = {
  created_at?: string;
  exam_id?: string;
  id: string;
  label?: string;
  max_score?: number | null;
  reason?: string | null;
  risk_level?: string | null;
  student_id?: string | null;
};

function getStringField(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRiskLabel(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'critical') {
    return 'Critical';
  }

  if (normalized === 'high') {
    return 'High-risk';
  }

  if (normalized === 'medium') {
    return 'Suspicious';
  }

  return 'Suspicious';
}

function normalizeNotificationToast(row: NotificationToastRow): AlertToast {
  const data = row.data ?? {};
  const examId = getStringField(data.examId);
  const eventId = getStringField(data.suspiciousEventId);

  return {
    body: String(row.body ?? '').trim() || 'A high-risk suspicious activity was detected.',
    createdAt: String(row.created_at ?? ''),
    eventId,
    examId,
    id: eventId ? `event:${eventId}` : `notification:${row.id}`,
    source: 'notification',
    title: String(row.title ?? '').trim() || 'Suspicious activity alert',
  };
}

function normalizeSuspiciousEventToast(row: SuspiciousEventToastRow): AlertToast | null {
  const eventId = getStringField(row.id);
  const examId = getStringField(row.exam_id);
  if (!eventId || !examId) {
    return null;
  }

  const riskLabel = normalizeRiskLabel(row.risk_level);
  const label = String(row.label ?? '').trim().replace(/_/g, ' ').toUpperCase();
  const score = Number(row.max_score);
  const scoreText = Number.isFinite(score) ? ` Score ${Math.round(score)}%.` : '';
  const reason = String(row.reason ?? '').trim() || 'Suspicious behavior detected.';

  return {
    body: `${reason}${scoreText}`,
    createdAt: String(row.created_at ?? ''),
    eventId,
    examId,
    id: `event:${eventId}`,
    source: 'event',
    title: label ? `${riskLabel} ${label}` : `${riskLabel} activity detected`,
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

  const showToast = useCallback(
    (toast: AlertToast) => {
      setToasts((current) => {
        const existingToast = current.find((item) => item.id === toast.id);
        if (existingToast?.source === 'notification' && toast.source === 'event') {
          return current;
        }

        return [
          toast,
          ...current.filter((item) => item.id !== toast.id),
        ].slice(0, MAX_TOASTS);
      });

      const existingTimer = timersRef.current[toast.id];
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      timersRef.current[toast.id] = setTimeout(() => {
        dismissToast(toast.id);
      }, TOAST_VISIBLE_MS);
    },
    [dismissToast]
  );

  const showSuspiciousEventToast = useCallback(
    async (row: SuspiciousEventToastRow) => {
      const eventId = getStringField(row.id);
      if (!eventId) {
        return;
      }

      const { data, error } = await supabase
        .from('suspicious_events')
        .select('id, exam_id, label, reason, risk_level, max_score, student_id, created_at')
        .eq('id', eventId)
        .maybeSingle<SuspiciousEventToastRow>();

      if (error || !data) {
        return;
      }

      const toast = normalizeSuspiciousEventToast(data);
      if (toast) {
        showToast(toast);
      }
    },
    [showToast]
  );

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

          showToast(normalizeNotificationToast(notification));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'suspicious_events',
        },
        (payload) => {
          void showSuspiciousEventToast(payload.new as SuspiciousEventToastRow);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, isLoading, profile?.id, role, showSuspiciousEventToast, showToast]);

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
