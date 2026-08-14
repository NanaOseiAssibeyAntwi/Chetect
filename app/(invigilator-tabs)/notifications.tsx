import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, AccentBadge, InlineMessage, SurfaceCard } from '@/components/product-ui';
import { layout, radius, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  fetchInvigilatorNotifications,
  type InvigilatorNotificationItem,
} from '@/lib/invigilator-sessions';

const EMPTY_NOTIFICATIONS: InvigilatorNotificationItem[] = [];

function formatNotificationTime(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
}

export default function InvigilatorNotificationsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    data: notifications,
    errorMessage,
    isLoading,
    refresh: refreshNotifications,
  } = useCachedResource<InvigilatorNotificationItem[]>({
    initialData: EMPTY_NOTIFICATIONS,
    key: 'invigilator.notifications',
    loader: fetchInvigilatorNotifications,
    maxAgeMs: 20_000,
  });

  useFocusEffect(
    useCallback(() => {
      void refreshNotifications();
      return undefined;
    }, [refreshNotifications])
  );

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <AppScreen accent="warning" contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(invigilator-tabs)/profile')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <Text style={styles.eyebrow}>NOTIFICATIONS</Text>
      </View>

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Feather color={colors.warning} name="bell" size={22} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>Alert Center</Text>
          <Text style={styles.meta}>
            {unreadCount} unread of {notifications.length} total
          </Text>
        </View>
      </SurfaceCard>

      {isLoading ? (
        <SurfaceCard style={styles.loadingCard} tone="muted">
          <ActivityIndicator color={colors.warning} size="small" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </SurfaceCard>
      ) : null}

      {errorMessage ? (
        <InlineMessage
          action={
            <ActionButton
              compact
              fullWidth={false}
              label="Retry"
              onPress={() => void refreshNotifications({ force: true })}
              tone="danger"
            />
          }
          description={errorMessage}
          style={styles.message}
          tone="danger"
        />
      ) : null}

      {!isLoading && !errorMessage && notifications.length === 0 ? (
        <InlineMessage
          description="Live alerts and review updates will appear here."
          style={styles.message}
          title="No notifications"
          tone="neutral"
        />
      ) : null}

      <View style={styles.list}>
        {notifications.map((notification) => (
          <SurfaceCard key={notification.id}>
            <View style={styles.notificationHeader}>
              <AccentBadge
                label={notification.isRead ? 'READ' : 'NEW'}
                tone={notification.isRead ? 'neutral' : 'warning'}
              />
              <Text style={styles.notificationTime}>
                {formatNotificationTime(notification.createdAt)}
              </Text>
            </View>
            <Text style={styles.notificationTitle}>{notification.title}</Text>
            <Text style={styles.notificationBody}>{notification.body}</Text>
            <Text style={styles.notificationType}>{notification.type}</Text>
          </SurfaceCard>
        ))}
      </View>
    </AppScreen>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    backButton: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    content: {
      paddingBottom: layout.bottomPadding,
    },
    eyebrow: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    heroCard: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      marginTop: 18,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    heroText: {
      flex: 1,
    },
    list: {
      gap: 12,
      marginTop: 14,
    },
    loadingCard: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
    },
    loadingText: {
      color: colors.mutedStrong,
      fontSize: type.body,
    },
    message: {
      marginTop: 14,
    },
    meta: {
      color: colors.mutedStrong,
      fontSize: type.body,
      marginTop: 6,
    },
    notificationBody: {
      color: colors.mutedStrong,
      fontSize: type.bodyLarge,
      lineHeight: 22,
      marginTop: 8,
    },
    notificationHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    notificationTime: {
      color: colors.muted,
      fontSize: type.tiny,
    },
    notificationTitle: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '800',
      marginTop: 14,
    },
    notificationType: {
      color: colors.muted,
      fontSize: type.tiny,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginTop: 12,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.text,
      fontSize: type.title + 2,
      fontWeight: '800',
    },
  });
}
