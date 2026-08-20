import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, AccentBadge, InlineMessage, SurfaceCard } from '@/components/product-ui';
import { font, layout, radius, shadow, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  fetchInvigilatorNotifications,
  setInvigilatorNotificationReadState,
  type InvigilatorNotificationItem,
} from '@/lib/invigilator-sessions';
import { clearScreenCache } from '@/lib/screen-cache';

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
  const [openNotificationId, setOpenNotificationId] = useState('');
  const [statusErrorMessage, setStatusErrorMessage] = useState('');
  const [updatingNotificationIds, setUpdatingNotificationIds] = useState<Record<string, boolean>>({});

  const {
    data: notifications,
    errorMessage,
    isLoading,
    refresh: refreshNotifications,
    setData: setNotifications,
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

  const handleToggleNotificationOpen = (notification: InvigilatorNotificationItem) => {
    setOpenNotificationId((current) => (current === notification.id ? '' : notification.id));
  };

  const handleSetNotificationReadState = async (
    notification: InvigilatorNotificationItem,
    isRead: boolean
  ) => {
    if (updatingNotificationIds[notification.id]) {
      return;
    }

    const previousNotifications = notifications;
    setStatusErrorMessage('');
    setUpdatingNotificationIds((current) => ({ ...current, [notification.id]: true }));
    setNotifications(
      notifications.map((item) => (item.id === notification.id ? { ...item, isRead } : item))
    );
    clearScreenCache('invigilator.profile');

    try {
      await setInvigilatorNotificationReadState({
        isRead,
        notificationId: notification.id,
      });
    } catch (error) {
      setNotifications(previousNotifications);
      setStatusErrorMessage(
        error instanceof Error ? error.message : 'Unable to update this notification.'
      );
    } finally {
      setUpdatingNotificationIds((current) => {
        const next = { ...current };
        delete next[notification.id];
        return next;
      });
    }
  };

  return (
    <AppScreen accent="warning" contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.navigate('/(invigilator-tabs)/profile')}
          style={({ pressed }) => [styles.backButton, pressed ? styles.buttonPressed : null]}>
          <Feather color={colors.warning} name="chevron-left" size={17} />
          <Text style={styles.backButtonText}>Profile</Text>
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

      {statusErrorMessage ? (
        <InlineMessage description={statusErrorMessage} style={styles.message} tone="danger" />
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
        {notifications.map((notification) => {
          const isOpen = openNotificationId === notification.id;
          const isUpdating = Boolean(updatingNotificationIds[notification.id]);

          return (
            <Pressable
              accessibilityRole="button"
              key={notification.id}
              onPress={() => handleToggleNotificationOpen(notification)}
              style={({ pressed }) => [
                styles.notificationCard,
                !notification.isRead ? styles.notificationCardUnread : null,
                isOpen ? styles.notificationCardOpen : null,
                pressed ? styles.notificationCardPressed : null,
              ]}>
              <View style={styles.notificationIcon}>
                <Feather
                  color={notification.isRead ? colors.mutedStrong : colors.warning}
                  name={notification.isRead ? 'bell' : 'alert-circle'}
                  size={19}
                />
              </View>

              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <View style={styles.notificationTitleBlock}>
                    <View style={styles.notificationTitleRow}>
                      <Text numberOfLines={isOpen ? 2 : 1} style={styles.notificationTitle}>
                        {notification.title}
                      </Text>
                      {!notification.isRead ? <View style={styles.newDot} /> : null}
                    </View>
                    <Text style={styles.notificationTime}>
                      {formatNotificationTime(notification.createdAt)}
                    </Text>
                  </View>

                  <Feather
                    color={colors.mutedStrong}
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                  />
                </View>

                <View style={styles.notificationFooter}>
                  <AccentBadge
                    label={notification.isRead ? 'READ' : 'UNREAD'}
                    tone={notification.isRead ? 'neutral' : 'warning'}
                  />
                  <Text numberOfLines={1} style={styles.notificationType}>{notification.type}</Text>
                </View>

                {isOpen ? (
                  <View style={styles.notificationDetails}>
                    <Text style={styles.notificationBody}>{notification.body}</Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isUpdating}
                      onPress={(event) => {
                        event.stopPropagation();
                        void handleSetNotificationReadState(notification, !notification.isRead);
                      }}
                      style={({ pressed }) => [
                        styles.readToggleButton,
                        notification.isRead ? styles.readToggleButtonRead : styles.readToggleButtonUnread,
                        (pressed || isUpdating) ? styles.buttonPressed : null,
                      ]}>
                      {isUpdating ? (
                        <ActivityIndicator
                          color={notification.isRead ? colors.mutedStrong : colors.warning}
                          size="small"
                        />
                      ) : (
                        <Feather
                          color={notification.isRead ? colors.mutedStrong : colors.warning}
                          name={notification.isRead ? 'circle' : 'check-circle'}
                          size={15}
                        />
                      )}
                      <Text
                        style={[
                          styles.readToggleText,
                          { color: notification.isRead ? colors.mutedStrong : colors.warning },
                        ]}>
                        Mark as {notification.isRead ? 'Unread' : 'Read'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </AppScreen>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    backButton: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.warningSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 5,
      minHeight: 38,
      justifyContent: 'center',
      paddingHorizontal: 12,
      ...shadow.card,
    },
    backButtonText: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
    },
    buttonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.985 }],
    },
    content: {
      paddingBottom: layout.bottomPadding,
    },
    eyebrow: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.label,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    heroCard: {
      alignItems: 'center',
      borderColor: colors.borderStrong,
      flexDirection: 'row',
      gap: 14,
      marginTop: 18,
      ...shadow.raised,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.md,
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
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '700',
    },
    message: {
      marginTop: 14,
    },
    meta: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 6,
    },
    notificationBody: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.bodyLarge,
      lineHeight: 22,
    },
    notificationCard: {
      alignItems: 'flex-start',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      borderLeftColor: colors.border,
      borderLeftWidth: 4,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      ...shadow.card,
    },
    notificationCardOpen: {
      borderColor: colors.borderStrong,
    },
    notificationCardPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.992 }],
    },
    notificationCardUnread: {
      backgroundColor: colors.panelRaised,
      borderColor: colors.warningSoft,
      borderLeftColor: colors.warning,
    },
    notificationContent: {
      flex: 1,
      minWidth: 0,
    },
    notificationDetails: {
      borderTopColor: colors.borderSoft,
      borderTopWidth: 1,
      marginTop: 13,
      paddingTop: 13,
    },
    notificationFooter: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    notificationHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    notificationIcon: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    notificationTime: {
      color: colors.muted,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '800',
    },
    notificationTitle: {
      color: colors.text,
      fontFamily: font.display,
      flex: 1,
      fontSize: type.bodyLarge,
      fontWeight: '900',
      lineHeight: 20,
    },
    notificationTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    notificationTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    notificationType: {
      color: colors.muted,
      flex: 1,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    newDot: {
      backgroundColor: colors.warning,
      borderRadius: radius.pill,
      height: 8,
      width: 8,
    },
    readToggleButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginTop: 13,
      minHeight: 38,
      paddingHorizontal: 13,
    },
    readToggleButtonRead: {
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
    },
    readToggleButtonUnread: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
    },
    readToggleText: {
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
    },
    title: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.display,
      fontWeight: '900',
      lineHeight: type.display + 5,
    },
  });
}
