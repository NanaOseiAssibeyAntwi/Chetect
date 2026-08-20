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

import { ActionButton, InlineMessage, SurfaceCard } from '@/components/product-ui';
import { layout, radius, shadow, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  fetchStudentDashboardData,
  type StudentDashboardActivity,
  type StudentDashboardData,
  type StudentDashboardExam,
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

function getIntegrityTone(score: number, colors: ReturnType<typeof useAppTheme>['colors']) {
  if (score >= 80) {
    return { color: colors.success, label: 'STRONG' };
  }

  if (score >= 60) {
    return { color: colors.warning, label: 'WATCH' };
  }

  return { color: colors.danger, label: 'LOW' };
}

function openExam(exam: StudentDashboardExam) {
  router.push({
    pathname: '/exam-session',
    params: { examId: exam.examId },
  });
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

  const exams = dashboardData?.exams ?? [];
  const activity = dashboardData?.activity ?? [];
  const studentName = dashboardData?.studentName ?? 'Student';
  const studentId = dashboardData?.studentId
    ? dashboardData.studentId.toUpperCase()
    : 'STUDENT ID NOT SET';
  const unreadNotifications = dashboardData?.unreadNotifications ?? 0;
  const liveExam = exams.find((exam) => exam.isLive) ?? null;
  const primaryExam = liveExam ?? exams[0] ?? null;
  const integrityScore = dashboardData?.stats.integrity ?? 0;
  const integrityTone = getIntegrityTone(integrityScore, colors);
  const hasUnreadNotifications = unreadNotifications > 0;

  const statItems = useMemo(
    () => [
      {
        color: colors.teal,
        icon: 'check-circle' as const,
        label: 'Taken',
        value: String(dashboardData?.stats.examsTaken ?? 0),
      },
      {
        color: colors.sky,
        icon: 'bar-chart-2' as const,
        label: 'Avg score',
        value: `${dashboardData?.stats.avgScore ?? 0}%`,
      },
      {
        color: integrityTone.color,
        icon: 'shield' as const,
        label: 'Integrity',
        value: `${integrityScore}`,
      },
    ],
    [colors.sky, colors.teal, dashboardData?.stats.avgScore, dashboardData?.stats.examsTaken, integrityScore, integrityTone.color]
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.topBarShell}>
        <View style={styles.topBar}>
          <View style={styles.portalMeta}>
            <Text style={styles.portalLabel}>STUDENT PORTAL</Text>
            <Text numberOfLines={1} style={styles.studentId}>{studentId}</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/notifications')}
              style={({ pressed }) => [styles.iconButton, pressed ? styles.buttonPressed : null]}>
              <Ionicons color={colors.mutedStrong} name="notifications-outline" size={19} />
              {hasUnreadNotifications ? (
                <View style={styles.notificationCount}>
                  <Text style={styles.notificationCountText}>
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/profile')}
              style={({ pressed }) => [styles.avatarBox, pressed ? styles.buttonPressed : null]}>
              <Text style={styles.avatarText}>{toInitials(studentName)}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.fixedHeroShell}>
        <View style={styles.heroPanel}>
          {primaryExam ? (
            <View style={styles.primaryExamHeader}>
              <View style={styles.primaryExamIcon}>
                <Feather
                  color={primaryExam.isLive ? colors.danger : colors.teal}
                  name={primaryExam.isLive ? 'radio' : 'calendar'}
                  size={17}
                />
              </View>
              <View style={styles.primaryExamText}>
                <View style={styles.primaryExamTopLine}>
                  <View style={styles.sessionStatePill}>
                    <View style={[styles.sessionStateDot, liveExam ? styles.sessionStateDotLive : null]} />
                    <Text style={styles.sessionStateText}>
                      {liveExam ? 'LIVE' : primaryExam.countdownToStart ?? 'READY'}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={styles.primaryExamCode}>{primaryExam.code}</Text>
                </View>
                <Text numberOfLines={1} style={styles.primaryExamTitle}>{primaryExam.title}</Text>
                <Text numberOfLines={1} style={styles.primaryMetaText}>{primaryExam.meta}</Text>
              </View>

              {primaryExam.isLive ? (
                <Pressable
                  onPress={() => openExam(primaryExam)}
                  style={({ pressed }) => [styles.primaryJoinButton, pressed ? styles.buttonPressed : null]}>
                  <Text style={styles.primaryJoinText}>Join</Text>
                  <Feather color="#ffffff" name="arrow-right" size={15} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyHeroRow}>
              <Feather color={colors.success} name="check-circle" size={19} />
              <Text style={styles.emptyHeroText}>You are all caught up.</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.fixedStatsShell}>
        <View style={styles.statGrid}>
          {statItems.map((item) => (
            <View key={item.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${item.color}18` }]}>
                <Feather color={item.color} name={item.icon} size={15} />
              </View>
              <Text numberOfLines={1} style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
              <Text numberOfLines={1} style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.fixedScheduleShell}>
        <View style={[styles.sectionHeader, styles.fixedSectionHeader]}>
          <View>
            <Text style={styles.sectionLabel}>EXAM SCHEDULE</Text>
            <Text style={styles.sectionSubcopy}>{dashboardData?.upcomingCount ?? 0} upcoming</Text>
          </View>
          <Feather color={colors.mutedStrong} name="calendar" size={18} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
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

        <View style={styles.cardList}>
          {exams.length === 0 && !isLoading && !errorMessage ? (
            <SurfaceCard tone="muted">
              <Text style={styles.emptyTitle}>No scheduled exams</Text>
              <Text style={styles.emptyCopy}>Your registered exam sessions will show up here.</Text>
            </SurfaceCard>
          ) : (
            exams.map((exam) => <ExamScheduleCard colors={colors} exam={exam} key={exam.examId} />)
          )}
        </View>

        <View style={[styles.sectionHeader, styles.activityHeader]}>
          <View>
            <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
            <Text style={styles.sectionSubcopy}>Latest completed sessions</Text>
          </View>
          <Feather color={colors.mutedStrong} name="activity" size={18} />
        </View>

        <View style={styles.cardList}>
          {activity.length === 0 && !isLoading && !errorMessage ? (
            <SurfaceCard tone="muted">
              <Text style={styles.emptyTitle}>No recent activity</Text>
              <Text style={styles.emptyCopy}>Completed sessions and summaries will appear here.</Text>
            </SurfaceCard>
          ) : (
            activity.map((item) => <ActivityRow colors={colors} item={item} key={`${item.title}-${item.date}`} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ExamScheduleCard({
  colors,
  exam,
}: {
  colors: ReturnType<typeof useAppTheme>['colors'];
  exam: StudentDashboardExam;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const accentColor = exam.isLive ? colors.danger : colors.teal;

  return (
    <View style={[styles.examCard, { borderLeftColor: accentColor }]}>
      <View style={styles.examMainRow}>
        <View style={styles.examIconWrap}>
          <Feather color={accentColor} name={exam.isLive ? 'radio' : 'book-open'} size={16} />
        </View>
        <View style={styles.examInfo}>
          <View style={styles.examCodeRow}>
            <Text numberOfLines={1} style={[styles.examCode, { color: accentColor }]}>{exam.code}</Text>
            <View style={[styles.examPill, exam.isLive ? styles.examPillLive : null]}>
              <Text style={[styles.examPillText, exam.isLive ? styles.examPillTextLive : null]}>
                {exam.isLive ? 'LIVE NOW' : exam.countdownToStart ?? 'SCHEDULED'}
              </Text>
            </View>
          </View>
          <Text numberOfLines={2} style={styles.examTitle}>{exam.title}</Text>
          <View style={styles.examMetaRow}>
            <Feather color={colors.muted} name="clock" size={12} />
            <Text numberOfLines={1} style={styles.examMeta}>{exam.meta}</Text>
          </View>
        </View>
      </View>

      {exam.isLive ? (
        <Pressable
          onPress={() => openExam(exam)}
          style={({ pressed }) => [styles.examJoinButton, pressed ? styles.buttonPressed : null]}>
          <Text style={styles.examJoinText}>Join</Text>
          <Feather color={colors.danger} name="arrow-right" size={14} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ActivityRow({
  colors,
  item,
}: {
  colors: ReturnType<typeof useAppTheme>['colors'];
  item: StudentDashboardActivity;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/results')}
      style={({ pressed }) => [styles.activityCard, pressed ? styles.buttonPressed : null]}>
      <View style={styles.activityIcon}>
        <Feather color={colors.teal} name="file-text" size={16} />
      </View>
      <View style={styles.activityText}>
        <Text numberOfLines={1} style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.activityDate}>{item.date}</Text>
      </View>
      <View style={styles.activityStats}>
        <Text style={styles.activityScore}>{item.score}</Text>
        <Text numberOfLines={1} style={styles.activityIntegrity}>INT {item.integrity}</Text>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    activityCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 76,
      paddingHorizontal: 14,
      paddingVertical: 14,
      ...shadow.card,
    },
    activityDate: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 6,
    },
    activityHeader: {
      marginTop: 28,
    },
    activityIcon: {
      alignItems: 'center',
      backgroundColor: colors.tealSoft,
      borderColor: colors.tealGlow,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    activityIntegrity: {
      color: colors.mutedStrong,
      fontSize: type.tiny,
      fontWeight: '800',
      letterSpacing: 0.6,
      marginTop: 5,
      textAlign: 'right',
    },
    activityScore: {
      color: colors.teal,
      fontSize: 19,
      fontWeight: '900',
      textAlign: 'right',
    },
    activityStats: {
      alignItems: 'flex-end',
      minWidth: 58,
    },
    activityText: {
      flex: 1,
      minWidth: 0,
    },
    activityTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '800',
    },
    avatarBox: {
      alignItems: 'center',
      backgroundColor: colors.tealSoft,
      borderColor: colors.tealGlow,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    avatarText: {
      color: colors.teal,
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
    content: {
      alignSelf: 'center',
      maxWidth: layout.maxWidth,
      paddingBottom: layout.bottomPadding,
      paddingHorizontal: layout.screenPaddingWide,
      paddingTop: 2,
      width: '100%',
    },
    emptyCopy: {
      color: colors.mutedStrong,
      fontSize: type.body,
      lineHeight: 21,
      marginTop: 8,
    },
    emptyHeroRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    emptyHeroText: {
      color: colors.text,
      flex: 1,
      fontSize: type.bodyLarge,
      fontWeight: '800',
    },
    emptyTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '800',
    },
    errorCard: {
      marginBottom: 14,
      marginTop: 12,
    },
    examCard: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: 14,
      paddingHorizontal: 14,
      paddingVertical: 15,
      ...shadow.card,
    },
    examCode: {
      flexShrink: 1,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.6,
    },
    examCodeRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      minHeight: 24,
    },
    examIconWrap: {
      alignItems: 'center',
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    examInfo: {
      flex: 1,
      minWidth: 0,
    },
    examJoinButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.dangerSoft,
      borderColor: colors.dangerSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      minHeight: 40,
      paddingHorizontal: 16,
    },
    examJoinText: {
      color: colors.danger,
      fontSize: type.body,
      fontWeight: '900',
    },
    examMainRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
    },
    examMeta: {
      color: colors.mutedStrong,
      flex: 1,
      fontSize: 12,
    },
    examMetaRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      marginTop: 11,
    },
    examPill: {
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexShrink: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    examPillLive: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.dangerSoft,
    },
    examPillText: {
      color: colors.mutedStrong,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.4,
    },
    examPillTextLive: {
      color: colors.danger,
    },
    examTitle: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '900',
      lineHeight: 24,
      marginTop: 4,
    },
    fixedHeroShell: {
      alignSelf: 'center',
      backgroundColor: colors.background,
      maxWidth: layout.maxWidth,
      paddingBottom: 6,
      paddingHorizontal: layout.screenPaddingWide,
      width: '100%',
    },
    fixedScheduleShell: {
      alignSelf: 'center',
      backgroundColor: colors.background,
      maxWidth: layout.maxWidth,
      paddingBottom: 8,
      paddingHorizontal: layout.screenPaddingWide,
      width: '100%',
    },
    fixedSectionHeader: {
      marginBottom: 0,
      marginTop: 0,
      minHeight: 40,
    },
    fixedStatsShell: {
      alignSelf: 'center',
      backgroundColor: colors.background,
      maxWidth: layout.maxWidth,
      paddingBottom: 8,
      paddingHorizontal: layout.screenPaddingWide,
      width: '100%',
    },
    headerActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    heroCopy: {
      color: colors.mutedStrong,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 6,
    },
    heroPanel: {
      backgroundColor: colors.panel,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: 0,
      overflow: 'hidden',
      paddingHorizontal: 12,
      paddingVertical: 10,
      ...shadow.raised,
    },
    heroTitle: {
      color: colors.text,
      fontSize: type.display,
      fontWeight: '900',
      letterSpacing: 0,
      marginTop: 12,
    },
    heroTopRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
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
    integrityPill: {
      alignItems: 'center',
      backgroundColor: colors.panelSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    integrityPillText: {
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.6,
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
    notificationCount: {
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
    notificationCountText: {
      color: '#ffffff',
      fontSize: 9,
      fontWeight: '900',
      lineHeight: 15,
    },
    portalLabel: {
      color: colors.teal,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 1.1,
    },
    portalMeta: {
      flex: 1,
      gap: 5,
      minWidth: 0,
    },
    primaryExamBlock: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      marginTop: 13,
      paddingTop: 12,
    },
    primaryExamCode: {
      color: colors.muted,
      fontSize: type.label,
      fontWeight: '900',
      letterSpacing: 0.7,
    },
    primaryExamHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    primaryExamIcon: {
      alignItems: 'center',
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    primaryExamText: {
      flex: 1,
      minWidth: 0,
    },
    primaryExamTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '900',
      lineHeight: 20,
      marginTop: 2,
    },
    primaryExamTopLine: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
      minHeight: 20,
    },
    primaryJoinButton: {
      alignItems: 'center',
      backgroundColor: colors.danger,
      borderRadius: radius.md,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: 13,
    },
    primaryJoinText: {
      color: '#ffffff',
      fontSize: type.body,
      fontWeight: '900',
    },
    primaryMetaRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
      marginTop: 10,
    },
    primaryMetaText: {
      color: colors.mutedStrong,
      flex: 1,
      fontSize: 12,
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
      marginBottom: 12,
      marginTop: 24,
    },
    sectionLabel: {
      color: colors.text,
      fontSize: type.body,
      fontWeight: '900',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    sectionSubcopy: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 4,
    },
    sessionStateDot: {
      backgroundColor: colors.success,
      borderRadius: radius.pill,
      height: 7,
      width: 7,
    },
    sessionStateDotLive: {
      backgroundColor: colors.danger,
    },
    sessionStatePill: {
      alignItems: 'center',
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    sessionStateText: {
      color: colors.mutedStrong,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.7,
    },
    startsInPill: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 7,
      marginTop: 12,
      maxWidth: '100%',
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    startsInText: {
      color: colors.mutedStrong,
      flexShrink: 1,
      fontSize: type.body,
      fontWeight: '800',
    },
    statCard: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      minHeight: 60,
      minWidth: 0,
      paddingHorizontal: 9,
      paddingVertical: 8,
      ...shadow.card,
    },
    statGrid: {
      flexDirection: 'row',
      gap: 10,
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
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.5,
      marginTop: 4,
      textTransform: 'uppercase',
    },
    statValue: {
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 0,
    },
    studentId: {
      color: colors.mutedStrong,
      fontSize: 12,
      fontWeight: '800',
    },
    topBar: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      justifyContent: 'space-between',
    },
    topBarShell: {
      alignSelf: 'center',
      backgroundColor: colors.background,
      maxWidth: layout.maxWidth,
      paddingBottom: 8,
      paddingHorizontal: layout.screenPaddingWide,
      paddingTop: 4,
      width: '100%',
    },
  });
}
