import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, AccentBadge, InlineMessage } from '@/components/product-ui';
import { font, layout, radius, shadow, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  fetchInvigilatorDashboardData,
  type InvigilatorDashboardData,
  type InvigilatorLiveSession,
  type SessionRiskLevel,
} from '@/lib/invigilator-sessions';

function riskLevelPresentation(riskLevel: SessionRiskLevel, colors: ReturnType<typeof useAppTheme>['colors']) {
  if (riskLevel === 'high') {
    return { color: colors.danger, label: 'HIGH', tone: 'danger' as const };
  }

  if (riskLevel === 'medium') {
    return { color: colors.warning, label: 'MED', tone: 'warning' as const };
  }

  return { color: colors.success, label: 'LOW', tone: 'success' as const };
}

function formatSessionStart(isoDate: string) {
  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unknown start time';
  }

  return parsedDate.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
}

function toInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || 'IV';
}

export default function InvigilatorDashboardScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    data: dashboardData,
    errorMessage,
    isLoading,
    isRefreshing,
    refresh: refreshDashboard,
  } = useCachedResource<InvigilatorDashboardData | null>({
    initialData: null,
    key: 'invigilator.dashboard',
    loader: fetchInvigilatorDashboardData,
    maxAgeMs: 20_000,
  });

  const handleRefresh = useCallback(async () => {
    await refreshDashboard({ force: true, showLoader: false });
  }, [refreshDashboard]);

  useFocusEffect(
    useCallback(() => {
      void refreshDashboard({ showLoader: dashboardData === null });
      return undefined;
    }, [dashboardData, refreshDashboard])
  );

  const sessions = dashboardData?.sessions ?? [];
  const staffName = dashboardData?.staffName ?? 'Invigilator';
  const staffMeta = dashboardData?.staffInstitutionalId
    ? `${dashboardData.staffInstitutionalId.toUpperCase()} - L2`
    : 'INVIGILATOR - L2';
  const activeSessionsCount = dashboardData?.stats.active ?? 0;
  const flaggedCount = dashboardData?.stats.flagged ?? 0;
  const onlineCount = dashboardData?.stats.online ?? 0;
  const totalSessions = dashboardData?.stats.totalSessions ?? 0;
  const doneCount = dashboardData?.stats.done ?? 0;
  const hasFlaggedSessions = flaggedCount > 0;

  const stats = useMemo(
    () => [
      {
        color: colors.warning,
        icon: 'radio' as const,
        label: 'Live',
        value: String(activeSessionsCount),
      },
      {
        color: colors.success,
        icon: 'users' as const,
        label: 'Online',
        value: String(onlineCount),
      },
      {
        color: hasFlaggedSessions ? colors.danger : colors.warning,
        icon: 'alert-triangle' as const,
        label: 'Flagged',
        value: String(flaggedCount),
      },
      {
        color: colors.teal,
        icon: 'check-circle' as const,
        label: 'Done',
        value: String(doneCount),
      },
    ],
    [activeSessionsCount, colors, doneCount, flaggedCount, hasFlaggedSessions, onlineCount]
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.topShell}>
        <View style={styles.topBar}>
          <View style={styles.staffBlock}>
            <Text style={styles.portalLabel}>INVIGILATOR PORTAL</Text>
            <Text numberOfLines={1} style={styles.staffName}>{staffName}</Text>
            <Text numberOfLines={1} style={styles.staffMeta}>{staffMeta}</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(invigilator-tabs)/notifications')}
              style={({ pressed }) => [styles.iconButton, pressed ? styles.buttonPressed : null]}>
              <Ionicons color={colors.mutedStrong} name="notifications-outline" size={19} />
              {hasFlaggedSessions ? (
                <View style={styles.alertCount}>
                  <Text style={styles.alertCountText}>{flaggedCount > 9 ? '9+' : flaggedCount}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(invigilator-tabs)/profile')}
              style={({ pressed }) => [styles.avatarBox, pressed ? styles.buttonPressed : null]}>
              <Text style={styles.avatarText}>{toInitials(staffName)}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.summaryShell}>
        <View style={styles.commandCard}>
          <View style={styles.commandInfo}>
            <View style={styles.commandLabelRow}>
              <View style={[styles.liveDot, hasFlaggedSessions ? styles.liveDotAlert : null]} />
              <Text style={styles.commandLabel}>ACTIVE MONITORING</Text>
            </View>
            <View style={styles.commandValueRow}>
              <Text style={styles.commandValue}>{activeSessionsCount}</Text>
              <Text style={styles.commandCaption}>
                {activeSessionsCount === 1 ? 'session live' : 'sessions live'}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(invigilator-tabs)/create')}
            style={({ pressed }) => [styles.createButton, pressed ? styles.buttonPressed : null]}>
            <Feather color="#ffffff" name="plus" size={15} />
            <Text style={styles.createButtonText}>Create</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsShell}>
        <View style={styles.statGrid}>
          {stats.map((item) => (
            <View key={item.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${item.color}18` }]}>
                <Feather color={item.color} name={item.icon} size={14} />
              </View>
              <Text numberOfLines={1} style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
              <Text numberOfLines={1} style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionShell}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Live sessions</Text>
            <Text style={styles.sectionMeta}>
              {totalSessions} assigned {totalSessions === 1 ? 'session' : 'sessions'}
            </Text>
          </View>
          <View style={[styles.statusPill, hasFlaggedSessions ? styles.statusPillAlert : null]}>
            <View style={[styles.statusDot, hasFlaggedSessions ? styles.statusDotAlert : null]} />
            <Text style={[styles.statusPillText, hasFlaggedSessions ? styles.statusPillTextAlert : null]}>
              {hasFlaggedSessions ? `${flaggedCount} flagged` : 'Stable'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.warning]}
            onRefresh={handleRefresh}
            progressBackgroundColor={colors.panel}
            refreshing={isRefreshing}
            tintColor={colors.warning}
          />
        }
        showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.warning} size="small" />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <InlineMessage
            action={
              <ActionButton
                compact
                fullWidth={false}
                label="Retry"
                onPress={() => void refreshDashboard({ force: true })}
                tone="danger"
              />
            }
            description={errorMessage}
            style={styles.errorMessage}
            tone="danger"
          />
        ) : null}

        <View style={styles.cardList}>
          {sessions.length === 0 && !isLoading && !errorMessage ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Feather color={colors.warning} name="calendar" size={19} />
              </View>
              <View style={styles.emptyText}>
                <Text style={styles.emptyTitle}>No live sessions yet</Text>
                <Text style={styles.emptyCopy}>Create a session to begin monitoring from this dashboard.</Text>
              </View>
            </View>
          ) : (
            sessions.map((session) => (
              <InvigilatorSessionCard colors={colors} key={session.examId} session={session} />
            ))
          )}
        </View>

        <View style={styles.alertSectionHeader}>
          <Text style={styles.sectionTitle}>Recent alerts</Text>
          <Feather color={colors.mutedStrong} name="activity" size={18} />
        </View>

        <InlineMessage
          description={
            hasFlaggedSessions
              ? 'Flagged sessions are waiting in live monitoring.'
              : 'No flagged activity right now.'
          }
          title="Alert stream"
          tone={hasFlaggedSessions ? 'warning' : 'success'}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function InvigilatorSessionCard({
  colors,
  session,
}: {
  colors: ReturnType<typeof useAppTheme>['colors'];
  session: InvigilatorLiveSession;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const riskPresentation = riskLevelPresentation(session.riskLevel, colors);

  return (
    <View style={[styles.sessionCard, { borderLeftColor: riskPresentation.color }]}>
      <View style={styles.sessionHeader}>
        <View style={styles.sessionTitleBlock}>
          <View style={styles.sessionMetaRow}>
            <Text numberOfLines={1} style={[styles.sessionCode, { color: riskPresentation.color }]}>
              {session.code}
            </Text>
            <AccentBadge label={riskPresentation.label} tone={riskPresentation.tone} />
          </View>
          <Text numberOfLines={2} style={styles.sessionTitle}>{session.title}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/(invigilator-tabs)/monitor',
              params: { examId: session.examId },
            })
          }
          style={({ pressed }) => [styles.monitorButton, pressed ? styles.buttonPressed : null]}>
          <Text style={styles.monitorText}>Monitor</Text>
          <Feather color={colors.warning} name="arrow-right" size={14} />
        </Pressable>
      </View>

      <View style={styles.sessionStatsRow}>
        <MiniSessionStat
          color={colors.teal}
          icon="users"
          label="registered"
          value={String(session.registeredStudents)}
        />
        <MiniSessionStat
          color={colors.success}
          icon="wifi"
          label="online"
          value={String(session.liveSessions)}
        />
        <MiniSessionStat
          color={session.flaggedSessions > 0 ? colors.danger : colors.mutedStrong}
          icon="alert-triangle"
          label="flagged"
          value={String(session.flaggedSessions)}
        />
      </View>

      <View style={styles.sessionFooter}>
        <View style={styles.sessionTime}>
          <Feather color={colors.muted} name="clock" size={12} />
          <Text numberOfLines={1} style={styles.sessionTimeText}>{formatSessionStart(session.scheduledStart)}</Text>
        </View>
        <Text numberOfLines={1} style={styles.sessionMode}>
          {session.monitoringMode.toUpperCase()} - {session.status.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

function MiniSessionStat({
  color,
  icon,
  label,
  value,
}: {
  color: string;
  icon: 'alert-triangle' | 'users' | 'wifi';
  label: string;
  value: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.miniStat}>
      <Feather color={color} name={icon} size={13} />
      <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
      <Text numberOfLines={1} style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    alertCount: {
      alignItems: 'center',
      backgroundColor: colors.danger,
      borderColor: colors.panel,
      borderRadius: radius.pill,
      borderWidth: 1,
      minWidth: 17,
      paddingHorizontal: 4,
      position: 'absolute',
      right: -3,
      top: -2,
    },
    alertCountText: {
      color: '#ffffff',
      fontFamily: font.body,
      fontSize: 9,
      fontWeight: '900',
      lineHeight: 15,
    },
    alertSectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
      marginTop: 28,
    },
    avatarBox: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    avatarText: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: 12,
      fontWeight: '900',
    },
    buttonPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.98 }],
    },
    cardList: {
      gap: 12,
    },
    commandCaption: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '800',
      marginBottom: 6,
    },
    commandCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      ...shadow.raised,
    },
    commandInfo: {
      flex: 1,
      minWidth: 0,
    },
    commandLabel: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    commandLabelRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
    },
    commandValue: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.display + 11,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: type.display + 16,
    },
    commandValueRow: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: 9,
      marginTop: 4,
    },
    content: {
      alignSelf: 'center',
      maxWidth: layout.maxWidth,
      paddingBottom: layout.bottomPadding,
      paddingHorizontal: layout.screenPaddingWide,
      paddingTop: 2,
      width: '100%',
    },
    createButton: {
      alignItems: 'center',
      backgroundColor: colors.warning,
      borderColor: colors.warning,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 7,
      minHeight: 42,
      paddingHorizontal: 14,
    },
    createButtonText: {
      color: '#ffffff',
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
    },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 16,
      ...shadow.card,
    },
    emptyCopy: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 4,
    },
    emptyIcon: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    emptyText: {
      flex: 1,
      minWidth: 0,
    },
    emptyTitle: {
      color: colors.text,
      fontFamily: font.body,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    errorMessage: {
      marginBottom: 14,
      marginTop: 12,
    },
    headerActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      position: 'relative',
      width: 40,
    },
    liveDot: {
      backgroundColor: colors.success,
      borderRadius: radius.pill,
      height: 7,
      width: 7,
    },
    liveDotAlert: {
      backgroundColor: colors.danger,
    },
    loadingCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      ...shadow.card,
    },
    loadingText: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '700',
    },
    miniStat: {
      alignItems: 'center',
      backgroundColor: colors.panelSoft,
      borderColor: colors.borderSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      gap: 4,
      minHeight: 62,
      minWidth: 0,
      paddingHorizontal: 5,
      paddingVertical: 8,
    },
    miniStatLabel: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '800',
    },
    miniStatValue: {
      fontFamily: font.display,
      fontSize: type.bodyLarge,
      fontWeight: '900',
      lineHeight: 18,
    },
    monitorButton: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      minHeight: 38,
      paddingHorizontal: 11,
    },
    monitorText: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
    },
    portalLabel: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 1.1,
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1,
    },
    scrollArea: {
      flex: 1,
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    sectionMeta: {
      color: colors.muted,
      fontFamily: font.body,
      fontSize: 12,
      marginTop: 3,
    },
    sectionShell: {
      alignSelf: 'center',
      backgroundColor: colors.background,
      maxWidth: layout.maxWidth,
      paddingBottom: 8,
      paddingHorizontal: layout.screenPaddingWide,
      width: '100%',
    },
    sectionTitle: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.bodyLarge,
      fontWeight: '900',
      letterSpacing: 0,
      textTransform: 'uppercase',
    },
    sessionCard: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: 13,
      paddingHorizontal: 14,
      paddingVertical: 14,
      ...shadow.card,
    },
    sessionCode: {
      flexShrink: 1,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.7,
    },
    sessionFooter: {
      alignItems: 'center',
      borderTopColor: colors.borderSoft,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
      paddingTop: 12,
    },
    sessionHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
    },
    sessionMetaRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      minHeight: 26,
    },
    sessionMode: {
      color: colors.muted,
      flexShrink: 1,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.5,
      textAlign: 'right',
    },
    sessionStatsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    sessionTime: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      minWidth: 0,
    },
    sessionTimeText: {
      color: colors.mutedStrong,
      flex: 1,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '700',
    },
    sessionTitle: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.title,
      fontWeight: '900',
      lineHeight: 23,
      marginTop: 5,
    },
    sessionTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    staffBlock: {
      flex: 1,
      minWidth: 0,
    },
    staffMeta: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: 12,
      fontWeight: '800',
      marginTop: 3,
    },
    staffName: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.display,
      fontWeight: '900',
      lineHeight: type.display + 5,
      marginTop: 5,
    },
    statCard: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      minHeight: 72,
      minWidth: 0,
      paddingHorizontal: 8,
      paddingVertical: 8,
      ...shadow.card,
    },
    statGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    statIcon: {
      alignItems: 'center',
      borderRadius: radius.pill,
      height: 22,
      justifyContent: 'center',
      marginBottom: 4,
      width: 22,
    },
    statLabel: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.4,
      marginTop: 4,
      textTransform: 'uppercase',
    },
    statValue: {
      fontFamily: font.display,
      fontSize: 19,
      fontWeight: '900',
      letterSpacing: 0,
    },
    statsShell: {
      alignSelf: 'center',
      backgroundColor: colors.background,
      maxWidth: layout.maxWidth,
      paddingBottom: 10,
      paddingHorizontal: layout.screenPaddingWide,
      width: '100%',
    },
    statusDot: {
      backgroundColor: colors.success,
      borderRadius: radius.pill,
      height: 7,
      width: 7,
    },
    statusDotAlert: {
      backgroundColor: colors.danger,
    },
    statusPill: {
      alignItems: 'center',
      backgroundColor: colors.successSoft,
      borderColor: colors.successSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 7,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    statusPillAlert: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.dangerSoft,
    },
    statusPillText: {
      color: colors.success,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    statusPillTextAlert: {
      color: colors.danger,
    },
    summaryShell: {
      alignSelf: 'center',
      backgroundColor: colors.background,
      maxWidth: layout.maxWidth,
      paddingBottom: 10,
      paddingHorizontal: layout.screenPaddingWide,
      width: '100%',
    },
    topBar: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      justifyContent: 'space-between',
    },
    topShell: {
      alignSelf: 'center',
      backgroundColor: colors.background,
      maxWidth: layout.maxWidth,
      paddingBottom: 10,
      paddingHorizontal: layout.screenPaddingWide,
      paddingTop: 4,
      width: '100%',
    },
  });
}
