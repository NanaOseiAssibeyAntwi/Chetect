import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

import { ActionButton, AccentBadge, InlineMessage, MetricTile, SurfaceCard } from '@/components/product-ui';
import { layout, radius, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  fetchInvigilatorDashboardData,
  type InvigilatorDashboardData,
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

export default function InvigilatorDashboardScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [dashboardData, setDashboardData] = useState<InvigilatorDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadDashboard = useCallback(async (options: { showLoader?: boolean } = {}) => {
    const shouldShowLoader = options.showLoader ?? true;
    if (shouldShowLoader) {
      setIsLoading(true);
    }
    setErrorMessage('');

    try {
      const result = await fetchInvigilatorDashboardData();
      setDashboardData(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load dashboard right now.'
      );
    } finally {
      if (shouldShowLoader) {
        setIsLoading(false);
      }
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadDashboard({ showLoader: false });
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
      return undefined;
    }, [loadDashboard])
  );

  const metrics = useMemo(
    () => [
      {
        label: 'SESSIONS',
        value: String(dashboardData?.stats.totalSessions ?? 0),
        valueColor: colors.teal,
      },
      {
        label: 'ONLINE',
        value: String(dashboardData?.stats.online ?? 0),
        valueColor: colors.success,
      },
      {
        label: 'FLAGGED',
        value: String(dashboardData?.stats.flagged ?? 0),
        valueColor: colors.warning,
      },
      {
        label: 'DONE',
        value: String(dashboardData?.stats.done ?? 0),
        valueColor: colors.mutedStrong,
      },
    ],
    [dashboardData, colors]
  );

  const sessions = dashboardData?.sessions ?? [];
  const staffName = dashboardData?.staffName ?? 'Invigilator';
  const staffMeta = dashboardData?.staffInstitutionalId
    ? `${dashboardData.staffInstitutionalId.toUpperCase()} - L2`
    : 'INVIGILATOR - L2';
  const activeSessionsCount = dashboardData?.stats.active ?? 0;
  const flaggedCount = dashboardData?.stats.flagged ?? 0;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
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
        <View style={styles.headerMetaRow}>
          <Text style={styles.staffMeta}>{staffMeta}</Text>
          <View style={styles.headerActions}>
            <Pressable
              hitSlop={10}
              onPress={() => router.push('/(invigilator-tabs)/notifications')}
              style={({ pressed }) => [styles.bellWrap, pressed ? styles.headerActionPressed : null]}>
              <Ionicons color={colors.mutedStrong} name="notifications-outline" size={18} />
              <View style={styles.alertCount}>
                <Text style={styles.alertCountText}>{flaggedCount}</Text>
              </View>
            </Pressable>
            <Pressable
              hitSlop={10}
              onPress={() => router.push('/(invigilator-tabs)/profile')}
              style={({ pressed }) => [styles.avatarBox, pressed ? styles.headerActionPressed : null]}>
              <Text style={styles.avatarText}>
                {staffName
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.staffName}>{staffName}</Text>

        <View style={styles.heroStatCard}>
          <View style={styles.heroStatTextBlock}>
            <Text style={styles.heroStatLabel}>ACTIVE RIGHT NOW</Text>
            <Text style={styles.heroStatValue}>{activeSessionsCount}</Text>
            <Text style={styles.heroStatCaption}>
              {activeSessionsCount === 1 ? 'session' : 'sessions'} currently being monitored
            </Text>
          </View>
          <View style={styles.heroStatIcon}>
            <Feather color={colors.warning} name="activity" size={26} />
          </View>
        </View>

        <View style={styles.metricRow}>
          {metrics.map((metric) => (
            <MetricTile
              accentColor={metric.valueColor}
              key={metric.label}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.warning} size="small" />
            <Text style={styles.loadingText}>Loading sessions...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <InlineMessage
            action={
              <ActionButton
                compact
                fullWidth={false}
                label="Retry"
                onPress={() => void loadDashboard()}
                tone="danger"
              />
            }
            description={errorMessage}
            style={styles.errorMessage}
            tone="danger"
          />
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>LIVE SESSIONS</Text>
          <View style={styles.sectionRight}>
            <View style={styles.sectionState}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionAccent}>{activeSessionsCount} active</Text>
            </View>
            <Pressable
              onPress={() => router.push('/(invigilator-tabs)/create')}
              style={styles.createButton}>
              <Feather color={colors.warning} name="plus" size={13} />
              <Text style={styles.createButtonText}>Create</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.cardList}>
          {sessions.length === 0 ? (
            <SurfaceCard>
              <Text style={styles.emptyTitle}>No active sessions yet</Text>
              <Text style={styles.emptyCopy}>
                Create your first exam session to populate this live dashboard.
              </Text>
            </SurfaceCard>
          ) : (
            sessions.map((session) => {
              const riskPresentation = riskLevelPresentation(session.riskLevel, colors);

              return (
                <SurfaceCard
                  accentColor={riskPresentation.color}
                  key={session.examId}
                  style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <View style={styles.sessionTitleBlock}>
                      <View style={styles.sessionMetaRow}>
                        <Text style={styles.sessionCode}>{session.code}</Text>
                        <AccentBadge label={riskPresentation.label} tone={riskPresentation.tone} />
                      </View>
                      <Text style={styles.sessionTitle}>{session.title}</Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/(invigilator-tabs)/monitor',
                          params: { examId: session.examId },
                        })
                      }
                      style={styles.monitorButton}>
                      <Text style={styles.monitorText}>Monitor</Text>
                      <Feather color={colors.teal} name="arrow-right" size={14} />
                    </Pressable>
                  </View>

                  <Text style={styles.sessionFoot}>
                    <Text style={styles.sessionStudents}>
                      {session.registeredStudents} registered
                    </Text>
                    <Text style={styles.sessionFlags}>   {session.flaggedSessions} flagged</Text>
                  </Text>
                  <Text style={styles.sessionTimeMeta}>
                    {formatSessionStart(session.scheduledStart)}   {session.monitoringMode.toUpperCase()}
                    {session.status.toUpperCase()}
                  </Text>
                </SurfaceCard>
              );
            })
          )}
        </View>

        <Text style={[styles.sectionLabel, styles.alertsHeader]}>RECENT ALERTS</Text>

        <View style={styles.cardList}>
          <InlineMessage
            description={
              flaggedCount > 0
                ? 'Flagged sessions are detected in live monitoring.'
                : 'No flagged activity yet. New alerts will appear here.'
            }
            title="Alert stream"
            tone={flaggedCount > 0 ? 'warning' : 'success'}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    alertCount: {
      alignItems: 'center',
      backgroundColor: colors.danger,
      borderRadius: 99,
      height: 16,
      justifyContent: 'center',
      position: 'absolute',
      right: -6,
      top: -6,
      width: 16,
    },
    alertCountText: {
      color: colors.background,
      fontSize: 9,
      fontWeight: '800',
    },
    alertsHeader: {
      marginBottom: 14,
      marginTop: 28,
    },
    avatarBox: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderRadius: radius.pill,
      height: 30,
      justifyContent: 'center',
      width: 30,
    },
    avatarText: {
      color: colors.warning,
      fontSize: 12,
      fontWeight: '800',
    },
    bellWrap: {
      padding: 2,
      position: 'relative',
    },
    cardList: {
      gap: 10,
    },
    content: {
      alignSelf: 'center',
      maxWidth: layout.maxWidth,
      paddingBottom: layout.bottomPadding,
      paddingHorizontal: layout.screenPaddingWide,
      width: '100%',
    },
    createButton: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    createButtonText: {
      color: colors.text,
      fontSize: type.body,
      fontWeight: '700',
    },
    emptyCopy: {
      color: colors.mutedStrong,
      fontSize: type.body,
      marginTop: 8,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '700',
    },
    errorMessage: {
      marginBottom: 14,
      marginTop: 12,
    },
    headerActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
    },
    headerActionPressed: {
      opacity: 0.78,
      transform: [{ scale: 0.96 }],
    },
    headerMetaRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    heroStatCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 18,
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    heroStatCaption: {
      color: colors.mutedStrong,
      fontSize: type.body,
      marginTop: 4,
    },
    heroStatIcon: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.pill,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
    heroStatLabel: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '800',
      letterSpacing: 1,
    },
    heroStatTextBlock: {
      flex: 1,
    },
    heroStatValue: {
      color: colors.text,
      fontSize: type.display + 8,
      fontWeight: '900',
      marginTop: 4,
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
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    loadingText: {
      color: colors.mutedStrong,
      fontSize: type.body,
    },
    metricRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 22,
      marginTop: 14,
    },
    monitorButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    monitorText: {
      color: colors.teal,
      fontSize: type.body,
      fontWeight: '700',
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1,
    },
    sectionAccent: {
      color: colors.danger,
      fontSize: type.body,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    sectionDot: {
      backgroundColor: colors.danger,
      borderRadius: 99,
      height: 6,
      width: 6,
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    sectionLabel: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    sectionRight: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    sectionState: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    sessionCard: {
      borderLeftWidth: 3,
    },
    sessionCode: {
      color: colors.muted,
      fontSize: 11,
    },
    sessionFlags: {
      color: colors.warning,
      fontSize: 13,
      fontWeight: '700',
    },
    sessionFoot: {
      color: colors.mutedStrong,
      fontSize: 13,
      marginTop: 12,
    },
    sessionHeader: {
      flexDirection: 'row',
      gap: 12,
    },
    sessionMetaRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    sessionStudents: {
      color: colors.mutedStrong,
    },
    sessionTimeMeta: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 10,
      textTransform: 'uppercase',
    },
    sessionTitle: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '700',
      marginTop: 10,
    },
    sessionTitleBlock: {
      flex: 1,
    },
    staffMeta: {
      color: colors.muted,
      fontSize: 11,
      letterSpacing: 0.4,
    },
    staffName: {
      color: colors.text,
      fontSize: type.display,
      fontWeight: '800',
      marginTop: 6,
    },
  });
}
