import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AccentBadge, ActionButton, InlineMessage, SurfaceCard } from '@/components/product-ui';
import { layout, radius, type } from '@/constants/design';
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

function getPerformanceLabel(scorePercent: number) {
  if (scorePercent >= 85) {
    return 'Excellent';
  }

  if (scorePercent >= 70) {
    return 'Great';
  }

  if (scorePercent >= 50) {
    return 'Fair';
  }

  return 'Needs Improvement';
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

  const performanceLabel = useMemo(
    () => getPerformanceLabel(resultData?.scorePercent ?? 0),
    [resultData?.scorePercent]
  );
  const scoreColor = useMemo(() => {
    const scorePercent = resultData?.scorePercent ?? 0;
    if (scorePercent >= 70) {
      return colors.success;
    }
    if (scorePercent >= 50) {
      return colors.warning;
    }
    return colors.danger;
  }, [colors, resultData?.scorePercent]);
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
    normalizedExamTitle || (isLoading && examId ? 'Submission received' : isLoading ? 'Loading result...' : 'Result unavailable');
  const headerMeta = normalizedCourseCode
    ? `${normalizedCourseCode} - ${submittedMeta}`
    : submittedMeta;

  return (
    <AppScreen accent="teal" contentContainerStyle={styles.content} edges={['top']}>
      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroText}>
          <Text style={styles.eyebrow}>POST-EXAM RESULT</Text>
          <Text style={styles.title}>{headerTitle}</Text>
          <Text style={styles.meta}>{headerMeta}</Text>
        </View>
        <AccentBadge label="SUBMITTED" style={styles.badge} tone="success" />
      </SurfaceCard>

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
              label={resultData ? 'Retry' : 'Back to dashboard'}
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

      {!isLoading && resultData ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>SCORE SUMMARY</Text>

          <SurfaceCard style={styles.scoreCard} tone="muted">
            <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
              <Text style={[styles.scoreValue, { color: scoreColor }]}>{resultData.scorePercent}%</Text>
            </View>
            <Text style={styles.scoreLabel}>{performanceLabel}</Text>
            <Text style={styles.scoreMeta}>
              {resultData.correctAnswers} correct out of {resultData.totalQuestions} questions
            </Text>
          </SurfaceCard>

          <SurfaceCard style={styles.remarkCard} tone="muted">
            <Text style={styles.remarkTitle}>Remark</Text>
            <Text style={styles.remarkCopy}>{resultData.remark}</Text>
          </SurfaceCard>
        </View>
      ) : null}
    </AppScreen>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    badge: {
      minHeight: 44,
      minWidth: 88,
    },
    content: {
      paddingBottom: layout.bottomPadding,
    },
    errorCard: {
      marginTop: 12,
    },
    eyebrow: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginTop: 2,
      textTransform: 'uppercase',
    },
    heroCard: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    heroText: {
      flex: 1,
    },
    loadingCard: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    loadingText: {
      color: colors.mutedStrong,
      fontSize: type.body,
    },
    meta: {
      color: colors.muted,
      fontSize: type.body,
      marginTop: 8,
    },
    remarkCard: {
      marginTop: 12,
    },
    remarkCopy: {
      color: colors.mutedStrong,
      fontSize: type.bodyLarge,
      lineHeight: 22,
      marginTop: 8,
    },
    remarkTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '700',
    },
    scoreCard: {
      alignItems: 'center',
      marginTop: 16,
      paddingVertical: 24,
    },
    scoreLabel: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '800',
      marginTop: 16,
    },
    scoreMeta: {
      color: colors.mutedStrong,
      fontSize: type.body,
      marginTop: 8,
    },
    scoreRing: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.pill,
      height: 128,
      justifyContent: 'center',
      width: 128,
    },
    scoreValue: {
      fontSize: 40,
      fontWeight: '900',
    },
    sectionBlock: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      paddingTop: 18,
    },
    sectionLabel: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '800',
      marginTop: 10,
    },
  });
}
