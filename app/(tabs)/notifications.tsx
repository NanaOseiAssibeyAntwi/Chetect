import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, InlineMessage, SurfaceCard } from '@/components/product-ui';
import { layout, radius, shadow, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  fetchStudentNotifications,
  type StudentNotificationItem,
} from '@/lib/student-profile';

const EMPTY_NOTIFICATIONS: StudentNotificationItem[] = [];

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

export default function NotificationsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    data: notifications,
    errorMessage,
    isLoading,
    refresh: refreshNotifications,
  } = useCachedResource<StudentNotificationItem[]>({
    initialData: EMPTY_NOTIFICATIONS,
    key: 'student.notifications',
    loader: fetchStudentNotifications,
    maxAgeMs: 30_000,
  });

  useFocusEffect(
    useCallback(() => {
      void refreshNotifications();
      return undefined;
    }, [refreshNotifications])
  );

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <AppScreen accent="teal" contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(tabs)/profile')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>NOTIFICATIONS</Text>
          <Text style={styles.headerTitle}>Alerts center</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons color={colors.teal} name="bell-ring-outline" size={24} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>Exam and account alerts</Text>
          <Text style={styles.meta}>{unreadCount} unread of {notifications.length} total</Text>
        </View>
        {unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <SurfaceCard style={styles.loadingCard} tone="muted">
          <ActivityIndicator color={colors.teal} size="small" />
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
          description="Exam alerts and account updates will appear here."
          style={styles.message}
          title="No notifications"
          tone="neutral"
        />
      ) : null}

      <View style={styles.list}>
        {notifications.map((notification) => (
          <View
            key={notification.id}
            style={[
              styles.notificationCard,
              !notification.isRead ? styles.notificationCardUnread : null,
            ]}>
            <View style={styles.notificationIcon}>
              <MaterialCommunityIcons
                color={notification.isRead ? colors.mutedStrong : colors.teal}
                name={notification.isRead ? 'bell-outline' : 'bell-badge-outline'}
                size={20}
              />
            </View>
            <View style={styles.notificationContent}>
              <View style={styles.notificationHeader}>
                <Text numberOfLines={1} style={styles.notificationTitle}>{notification.title}</Text>
                {!notification.isRead ? <View style={styles.newDot} /> : null}
              </View>
              <Text style={styles.notificationBody}>{notification.body}</Text>
              <View style={styles.notificationFooter}>
                <Text numberOfLines={1} style={styles.notificationType}>{notification.type}</Text>
                <Text style={styles.notificationTime}>{formatNotificationTime(notification.createdAt)}</Text>
              </View>
            </View>
          </View>
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
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    content: {
      paddingBottom: layout.bottomPadding,
    },
    eyebrow: {
      color: colors.teal,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    headerText: {
      flex: 1,
      gap: 3,
    },
    headerTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    heroCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 13,
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 15,
      ...shadow.raised,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.tealSoft,
      borderColor: colors.tealGlow,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    heroText: {
      flex: 1,
      minWidth: 0,
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
      marginTop: 5,
    },
    newDot: {
      backgroundColor: colors.teal,
      borderRadius: radius.pill,
      height: 8,
      width: 8,
    },
    notificationBody: {
      color: colors.mutedStrong,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 7,
    },
    notificationCard: {
      alignItems: 'flex-start',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      ...shadow.card,
    },
    notificationCardUnread: {
      borderColor: colors.tealGlow,
      borderLeftColor: colors.teal,
      borderLeftWidth: 3,
    },
    notificationContent: {
      flex: 1,
      minWidth: 0,
    },
    notificationFooter: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
      marginTop: 11,
    },
    notificationHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    notificationIcon: {
      alignItems: 'center',
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    notificationTime: {
      color: colors.muted,
      fontSize: type.tiny,
      fontWeight: '700',
    },
    notificationTitle: {
      color: colors.text,
      flex: 1,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    notificationType: {
      color: colors.muted,
      flex: 1,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '900',
    },
    unreadBadge: {
      alignItems: 'center',
      backgroundColor: colors.teal,
      borderRadius: radius.pill,
      minWidth: 28,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    unreadBadgeText: {
      color: '#ffffff',
      fontSize: type.tiny,
      fontWeight: '900',
    },
  });
}
