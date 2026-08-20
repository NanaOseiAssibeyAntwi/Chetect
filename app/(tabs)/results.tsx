import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, InlineMessage, SurfaceCard } from '@/components/product-ui';
import { layout, radius, shadow, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
import { useAppTheme } from '@/hooks/use-app-theme';
import { fetchStudentExamResult, type StudentExamResultData } from '@/lib/student-exam';

function formatSubmittedAt(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown submission time';
  }

  return `${date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })} at ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function getPerformance(scorePercent: number, colors: ReturnType<typeof useAppTheme>['colors']) {
  if (scorePercent >= 85) {
    return { color: colors.success, icon: 'trophy-outline' as const, label: 'Excellent' };
  }

  if (scorePercent >= 70) {
    return { color: colors.teal, icon: 'check-decagram-outline' as const, label: 'Great' };
  }

  if (scorePercent >= 50) {
    return { color: colors.warning, icon: 'progress-alert' as const, label: 'Fair' };
  }

  return { color: colors.danger, icon: 'alert-circle-outline' as const, label: 'Needs Improvement' };
}

export default function ResultsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const params = useLocalSearchParams<{ examId?: string }>();
  const examId = typeof params.examId === 'string' ? params.examId : undefined;

  const resultCacheKey = `student.result.${examId ?? 'latest'}`;
  const loadResult = useCallback(() => fetchStudentExamResult(examId), [examId]);
  const {
    data: resultData,
    errorMessage,
    isLoading,
    refresh: refreshResult,
  } = useCachedResource<StudentExamResultData | null>({
    initialData: null,
    key: resultCacheKey,
    loader: loadResult,
    maxAgeMs: 5 * 60_000,
  });

  useEffect(() => {
    void refreshResult({ showLoader: resultData === null });
  }, [refreshResult, resultData]);

  const scorePercent = resultData?.scorePercent ?? 0;
  const performance = getPerformance(scorePercent, colors);
  const normalizedExamTitle = String(resultData?.examTitle ?? '').trim();
  const normalizedCourseCode = String(resultData?.courseCode ?? '')
    .trim()
    .toUpperCase();
  const submittedMeta =
    resultData?.submittedAt && String(resultData.submittedAt).trim()
      ? formatSubmittedAt(resultData.submittedAt)
      : isLoading
      ? 'Loading submission time...'
      : 'Submission time unavailable';
  const headerTitle =
    normalizedExamTitle ||
    (isLoading && examId ? 'Submission received' : isLoading ? 'Loading result...' : 'Result unavailable');
  const integrityScore = Math.max(0, 100 - scorePercent);

  return (
    <AppScreen accent="teal" contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(tabs)')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>RESULTS</Text>
          <Text numberOfLines={1} style={styles.headerTitle}>Exam outcome</Text>
        </View>
      </View>

      {isLoading ? (
        <SurfaceCard style={styles.loadingCard} tone="muted">
          <ActivityIndicator color={colors.teal} size="small" />
          <Text style={styles.loadingText}>
            {examId ? 'Preparing your result...' : 'Loading result...'}
          </Text>
        </SurfaceCard>
      ) : null}

      {errorMessage ? (
        <InlineMessage
          action={
            <ActionButton
              compact
              fullWidth={false}
              label={resultData ? 'Retry' : 'Back home'}
              onPress={() =>
                resultData
                  ? void refreshResult({ force: true })
                  : router.replace('/(tabs)')
              }
              tone="danger"
            />
          }
          description={errorMessage}
          style={styles.errorCard}
          tone="danger"
        />
      ) : null}

      {resultData ? (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.coursePill}>
                <Text numberOfLines={1} style={styles.coursePillText}>
                  {normalizedCourseCode || 'COURSE'}
                </Text>
              </View>
              <View style={[styles.performancePill, { borderColor: performance.color }]}>
                <MaterialCommunityIcons color={performance.color} name={performance.icon} size={15} />
                <Text style={[styles.performancePillText, { color: performance.color }]}>
                  {performance.label}
                </Text>
              </View>
            </View>

            <Text numberOfLines={2} style={styles.title}>{headerTitle}</Text>
            <Text style={styles.meta}>{submittedMeta}</Text>

            <View style={styles.scoreRow}>
              <View style={[styles.scoreRing, { borderColor: performance.color }]}>
                <Text style={[styles.scoreValue, { color: performance.color }]}>{scorePercent}%</Text>
                <Text style={styles.scoreCaption}>Score</Text>
              </View>
              <View style={styles.scoreSummary}>
                <Text style={styles.summaryLabel}>Correct answers</Text>
                <Text style={styles.summaryValue}>
                  {resultData.correctAnswers} / {resultData.totalQuestions}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: performance.color, width: `${Math.max(4, scorePercent)}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Feather color={colors.teal} name="target" size={17} />
              <Text style={styles.metricValue}>{resultData.correctAnswers}</Text>
              <Text style={styles.metricLabel}>Correct</Text>
            </View>
            <View style={styles.metricCard}>
              <Feather color={colors.sky} name="list" size={17} />
              <Text style={styles.metricValue}>{resultData.totalQuestions}</Text>
              <Text style={styles.metricLabel}>Questions</Text>
            </View>
            <View style={styles.metricCard}>
              <Feather color={colors.success} name="shield" size={17} />
              <Text style={styles.metricValue}>{integrityScore}</Text>
              <Text style={styles.metricLabel}>Integrity</Text>
            </View>
          </View>

          <SurfaceCard style={styles.remarkCard} tone="muted">
            <View style={styles.remarkHeader}>
              <Feather color={colors.teal} name="message-square" size={17} />
              <Text style={styles.remarkTitle}>Remark</Text>
            </View>
            <Text style={styles.remarkCopy}>{resultData.remark}</Text>
          </SurfaceCard>

          <View style={styles.actionsRow}>
            <ActionButton
              compact
              fullWidth={false}
              icon={<Feather color="#ffffff" name="home" size={14} />}
              label="Home"
              onPress={() => router.replace('/(tabs)')}
              tone="primary"
            />
            <ActionButton
              compact
              fullWidth={false}
              icon={<Feather color={colors.text} name="clock" size={14} />}
              label="History"
              onPress={() => router.push('/(tabs)/session-history')}
              tone="secondary"
            />
          </View>
        </>
      ) : null}
    </AppScreen>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
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
    coursePill: {
      backgroundColor: colors.tealSoft,
      borderColor: colors.tealGlow,
      borderRadius: radius.pill,
      borderWidth: 1,
      maxWidth: '52%',
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    coursePillText: {
      color: colors.teal,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.7,
    },
    errorCard: {
      marginTop: 12,
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
      backgroundColor: colors.panel,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      ...shadow.raised,
    },
    heroTop: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
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
    meta: {
      color: colors.mutedStrong,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 8,
    },
    metricCard: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      minHeight: 84,
      paddingHorizontal: 12,
      paddingVertical: 12,
      ...shadow.card,
    },
    metricGrid: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    metricLabel: {
      color: colors.mutedStrong,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.5,
      marginTop: 4,
      textTransform: 'uppercase',
    },
    metricValue: {
      color: colors.text,
      fontSize: 21,
      fontWeight: '900',
      marginTop: 8,
    },
    performancePill: {
      alignItems: 'center',
      backgroundColor: colors.panelSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    performancePillText: {
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    progressFill: {
      borderRadius: radius.pill,
      bottom: 0,
      left: 0,
      position: 'absolute',
      top: 0,
    },
    progressTrack: {
      backgroundColor: colors.borderSoft,
      borderRadius: radius.pill,
      height: 8,
      marginTop: 12,
      overflow: 'hidden',
      width: '100%',
    },
    remarkCard: {
      marginTop: 14,
    },
    remarkCopy: {
      color: colors.mutedStrong,
      fontSize: type.bodyLarge,
      lineHeight: 22,
      marginTop: 10,
    },
    remarkHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 9,
    },
    remarkTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    scoreCaption: {
      color: colors.mutedStrong,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.8,
      marginTop: 2,
      textTransform: 'uppercase',
    },
    scoreRing: {
      alignItems: 'center',
      backgroundColor: colors.panelSoft,
      borderRadius: radius.pill,
      borderWidth: 2,
      height: 112,
      justifyContent: 'center',
      width: 112,
    },
    scoreRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 16,
      marginTop: 18,
    },
    scoreSummary: {
      flex: 1,
      minWidth: 0,
    },
    scoreValue: {
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: 0,
    },
    summaryLabel: {
      color: colors.mutedStrong,
      fontSize: type.body,
      fontWeight: '800',
    },
    summaryValue: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '900',
      marginTop: 5,
    },
    title: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '900',
      lineHeight: 24,
      marginTop: 14,
    },
  });
}
