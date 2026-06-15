import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, palette, type } from '@/constants/design';
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
  const params = useLocalSearchParams<{ examId?: string }>();
  const examId = typeof params.examId === 'string' ? params.examId : undefined;

  const [resultData, setResultData] = useState<StudentExamResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadResult = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const result = await fetchStudentExamResult(examId);
        if (!isMounted) {
          return;
        }

        setResultData(result);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load exam result.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadResult();

    return () => {
      isMounted = false;
    };
  }, [examId]);

  const performanceLabel = useMemo(
    () => getPerformanceLabel(resultData?.scorePercent ?? 0),
    [resultData?.scorePercent]
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View>
            <Text style={styles.eyebrow}>POST-EXAM RESULT</Text>
            <Text style={styles.title}>{resultData?.examTitle ?? 'Exam Result'}</Text>
            <Text style={styles.meta}>
              {(resultData?.courseCode ?? 'COURSE') + ' - ' + formatSubmittedAt(resultData?.submittedAt ?? '')}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>SUBMITTED</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={palette.teal} size="small" />
            <Text style={styles.loadingText}>Loading result...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable onPress={() => router.replace('/(tabs)')} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Back to dashboard</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && !errorMessage && resultData ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>SCORE SUMMARY</Text>

            <View style={styles.scoreCard}>
              <Text style={styles.scoreValue}>{resultData.scorePercent}%</Text>
              <Text style={styles.scoreLabel}>{performanceLabel}</Text>
              <Text style={styles.scoreMeta}>
                {resultData.correctAnswers} correct out of {resultData.totalQuestions} questions
              </Text>
            </View>

            <View style={styles.remarkCard}>
              <Text style={styles.remarkTitle}>Remark</Text>
              <Text style={styles.remarkCopy}>{resultData.remark}</Text>
            </View>

            <Pressable onPress={() => router.replace('/(tabs)')} style={styles.secondaryButton}>
              <Feather color={palette.mutedStrong} name="home" size={15} />
              <Text style={styles.secondaryButtonText}>Back to Home</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderColor: '#107f5f',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: 10,
  },
  badgeText: {
    color: palette.success,
    fontSize: type.tiny,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  content: {
    alignSelf: 'center',
    maxWidth: layout.maxWidth,
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  eyebrow: {
    color: palette.mutedStrong,
    fontSize: type.label,
    letterSpacing: 2.2,
    marginTop: 2,
  },
  errorCard: {
    alignItems: 'flex-start',
    backgroundColor: '#2f1116',
    borderColor: '#8f2d37',
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  errorText: {
    color: '#ff9ea8',
    fontSize: type.body,
  },
  heroCard: {
    alignItems: 'flex-start',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  loadingText: {
    color: palette.mutedStrong,
    fontSize: type.body,
  },
  meta: {
    color: palette.muted,
    fontSize: type.body,
    marginTop: 8,
  },
  remarkCard: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  remarkCopy: {
    color: palette.mutedStrong,
    fontSize: type.bodyLarge,
    lineHeight: 22,
    marginTop: 8,
  },
  remarkTitle: {
    color: palette.text,
    fontSize: type.bodyLarge,
    fontWeight: '700',
  },
  retryButton: {
    borderColor: '#b34954',
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#ff9ea8',
    fontSize: type.body,
    fontWeight: '700',
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  scoreCard: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 22,
  },
  scoreLabel: {
    color: palette.success,
    fontSize: type.title,
    fontWeight: '700',
    marginTop: 8,
  },
  scoreMeta: {
    color: palette.mutedStrong,
    fontSize: type.body,
    marginTop: 8,
  },
  scoreValue: {
    color: palette.teal,
    fontSize: 46,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: palette.mutedStrong,
    fontSize: type.bodyLarge,
  },
  sectionBlock: {
    borderTopColor: palette.border,
    borderTopWidth: 1,
    paddingTop: 18,
  },
  sectionLabel: {
    color: palette.mutedStrong,
    fontSize: type.label,
    letterSpacing: 2,
  },
  title: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: '800',
    marginTop: 10,
  },
});
