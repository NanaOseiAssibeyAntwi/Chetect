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

import { layout, radius, shadow, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
import { AccentBadge, ActionButton, InlineMessage, MetricTile, SurfaceCard } from '@/components/product-ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  fetchStudentDashboardData,
  type StudentDashboardData,
} from '@/lib/student-dashboard';

function toInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || 'ST';
}

export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    data: dashboardData,
    errorMessage,
    isLoading,
    isRefreshing,
    refresh: refreshDashboard,
  } = useCachedResource<StudentDashboardData | null>({
    initialData: null,
    key: 'student.dashboard',
    loader: fetchStudentDashboardData,
    maxAgeMs: 30_000,
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

  const metrics = useMemo(
    () => [
      { label: 'EXAMS TAKEN', value: String(dashboardData?.stats.examsTaken ?? 0) },
      { label: 'AVG SCORE', value: `${dashboardData?.stats.avgScore ?? 0}%` },
      { label: 'INTEGRITY', value: String(dashboardData?.stats.integrity ?? 0) },
    ],
    [dashboardData]
  );

  const exams = dashboardData?.exams ?? [];
  const activity = dashboardData?.activity ?? [];
  const studentName = dashboardData?.studentName ?? 'Student';
  const studentId = dashboardData?.studentId
    ? dashboardData.studentId.toUpperCase()
    : 'STUDENT ID NOT SET';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.teal]}
            onRefresh={handleRefresh}
            progressBackgroundColor={colors.panel}
            refreshing={isRefreshing}
            tintColor={colors.teal}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroGradient}>
          <View style={styles.headerMetaRow}>
            <Text style={styles.studentId}>{studentId}</Text>
            <View style={styles.headerActions}>
              <View style={styles.bellWrap}>
                <Ionicons color={colors.mutedStrong} name="notifications-outline" size={18} />
                {(dashboardData?.unreadNotifications ?? 0) > 0 ? <View style={styles.bellDot} /> : null}
              </View>
              <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.avatarBox}>
                <Text style={styles.avatarText}>{toInitials(studentName)}</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.heroGreeting}>Welcome back</Text>
          <Text style={styles.studentName}>{studentName}</Text>
        </View>

        <View style={styles.metricRow}>
          {metrics.map((metric) => (
            <MetricTile
              accentColor={colors.teal}
              key={metric.label}
              label={metric.label}
              style={styles.metricTile}
              value={metric.value}
            />
          ))}
        </View>

        {isLoading ? (
          <SurfaceCard style={styles.loadingCard} tone="muted">
            <ActivityIndicator color={colors.teal} size="small" />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </SurfaceCard>
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
            style={styles.errorCard}
            tone="danger"
          />
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>EXAM SCHEDULE</Text>
          <Text style={styles.sectionAccent}>{dashboardData?.upcomingCount ?? 0} upcoming</Text>
        </View>

        <View style={styles.cardList}>
          {exams.length === 0 && !isLoading && !errorMessage ? (
            <SurfaceCard tone="muted">
              <Text style={styles.emptyTitle}>No scheduled exams</Text>
              <Text style={styles.emptyCopy}>
                Your upcoming exam sessions will show up here once registered.
              </Text>
            </SurfaceCard>
          ) : (
            exams.map((exam) =>
              exam.isLive ? (
                <View key={exam.examId} style={styles.liveExamCard}>
                  <View style={styles.examRow}>
                    <View style={styles.examInfo}>
                      <View style={styles.examCodeRow}>
                        <Text style={styles.examCodeLive}>{exam.code}</Text>
                        <View style={styles.liveChip}>
                          <View style={styles.liveDot} />
                          <Text style={styles.liveChipText}>LIVE NOW</Text>
                        </View>
                      </View>
                      <Text style={styles.examTitleLive}>{exam.title}</Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/exam-session',
                          params: { examId: exam.examId },
                        })
                      }
                      style={({ pressed }) => [styles.liveJoinButton, pressed ? styles.liveJoinButtonPressed : null]}>
                      <Text style={styles.liveJoinText}>Join</Text>
                      <Feather color={colors.danger} name="arrow-right" size={14} />
                    </Pressable>
                  </View>
                  <Text style={styles.examMetaLive}>{exam.meta}</Text>
                </View>
              ) : (
                <SurfaceCard key={exam.examId} style={styles.examCard}>
                  <View style={styles.examRow}>
                    <View style={styles.examInfo}>
                      <View style={styles.examCodeRow}>
                        <Text style={styles.examCode}>{exam.code}</Text>
                        {exam.countdownToStart ? (
                          <AccentBadge label={exam.countdownToStart} tone="neutral" />
                        ) : null}
                      </View>
                      <Text style={styles.examTitle}>{exam.title}</Text>
                    </View>
                  </View>
                  <Text style={styles.examMeta}>{exam.meta}</Text>
                </SurfaceCard>
              )
            )
          )}
        </View>

        <Text style={[styles.sectionLabel, styles.activityHeader]}>RECENT ACTIVITY</Text>

        <View style={styles.cardList}>
          {activity.length === 0 && !isLoading && !errorMessage ? (
            <SurfaceCard tone="muted">
              <Text style={styles.emptyTitle}>No recent activity</Text>
              <Text style={styles.emptyCopy}>
                Your completed sessions and integrity summaries will appear here.
              </Text>
            </SurfaceCard>
          ) : (
            activity.map((item) => (
              <Pressable
                key={`${item.title}-${item.date}`}
                onPress={() => router.push('/(tabs)/results')}
                style={({ pressed }) => [styles.activityCard, pressed ? styles.activityCardPressed : null]}>
                <View>
                  <Text style={styles.activityTitle}>{item.title}</Text>
                  <Text style={styles.activityDate}>{item.date}</Text>
                </View>
                <View style={styles.activityStats}>
                  <Text style={styles.activityScore}>{item.score}</Text>
                  <Text style={styles.activityIntegrity}>INTEGRITY {item.integrity}</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    activityCard: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 16,
      ...shadow.card,
    },
    activityCardPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.99 }],
    },
    activityDate: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 12,
    },
    activityHeader: {
      marginBottom: 14,
      marginTop: 26,
    },
    activityIntegrity: {
      color: colors.mutedStrong,
      fontSize: type.tiny,
      letterSpacing: 1.2,
      marginTop: 6,
    },
    activityScore: {
      color: colors.teal,
      fontSize: 20,
      fontWeight: '800',
      textAlign: 'right',
    },
    activityStats: {
      alignItems: 'flex-end',
    },
    activityTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    avatarBox: {
      alignItems: 'center',
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    avatarText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    bellDot: {
      backgroundColor: colors.danger,
      borderRadius: 99,
      height: 6,
      position: 'absolute',
      right: 0,
      top: 1,
      width: 6,
    },
    bellWrap: {
      padding: 2,
      position: 'relative',
    },
    cardList: {
      gap: 12,
    },
    content: {
      alignSelf: 'center',
      maxWidth: layout.maxWidth,
      paddingBottom: layout.bottomPadding,
      paddingHorizontal: layout.screenPaddingWide,
      width: '100%',
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
    errorCard: {
      marginBottom: 14,
      marginTop: 12,
    },
    examCard: {
      gap: 0,
    },
    examCode: {
      color: colors.muted,
      fontSize: 11,
    },
    examCodeLive: {
      color: colors.danger,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    examCodeRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    examInfo: {
      flex: 1,
      gap: 8,
    },
    examMeta: {
      color: colors.mutedStrong,
      fontSize: 12,
      marginTop: 14,
    },
    examMetaLive: {
      color: colors.mutedStrong,
      fontSize: 12,
      marginTop: 14,
    },
    examRow: {
      flexDirection: 'row',
      gap: 12,
    },
    examTitle: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '700',
    },
    examTitleLive: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '800',
    },
    headerActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
    },
    headerMetaRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    heroGradient: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: 4,
      paddingHorizontal: 18,
      paddingVertical: 18,
    },
    heroGreeting: {
      color: colors.mutedStrong,
      fontSize: type.body,
      fontWeight: '600',
      marginTop: 18,
    },
    liveChip: {
      alignItems: 'center',
      backgroundColor: colors.dangerSoft,
      borderRadius: radius.pill,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    liveChipText: {
      color: colors.danger,
      fontSize: type.tiny,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    liveDot: {
      backgroundColor: colors.danger,
      borderRadius: 99,
      height: 6,
      width: 6,
    },
    liveExamCard: {
      backgroundColor: colors.panel,
      borderColor: colors.danger,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: 18,
      paddingVertical: 18,
    },
    liveJoinButton: {
      alignItems: 'center',
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.pill,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    liveJoinButtonPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.98 }],
    },
    liveJoinText: {
      color: colors.danger,
      fontSize: type.body,
      fontWeight: '800',
    },
    loadingCard: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
      marginTop: 12,
    },
    loadingText: {
      color: colors.mutedStrong,
      fontSize: type.body,
    },
    metricRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 22,
      marginTop: 14,
    },
    metricTile: {
      minHeight: 68,
      paddingVertical: 11,
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1,
    },
    sectionAccent: {
      color: colors.success,
      fontSize: type.body,
      fontWeight: '700',
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
    studentId: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.4,
    },
    studentName: {
      color: colors.text,
      fontSize: type.hero,
      fontWeight: '800',
      marginTop: 4,
    },
  });
}
