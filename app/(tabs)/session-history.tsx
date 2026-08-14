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
  fetchStudentSessionHistory,
  type StudentSessionHistoryItem,
} from '@/lib/student-profile';

const EMPTY_HISTORY: StudentSessionHistoryItem[] = [];

function formatSubmittedAt(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown submission time';
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getScoreTone(scorePercent: number) {
  if (scorePercent >= 70) {
    return 'success' as const;
  }

  if (scorePercent >= 50) {
    return 'warning' as const;
  }

  return 'danger' as const;
}

export default function SessionHistoryScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    data: history,
    errorMessage,
    isLoading,
    refresh: refreshHistory,
  } = useCachedResource<StudentSessionHistoryItem[]>({
    initialData: EMPTY_HISTORY,
    key: 'student.session-history',
    loader: fetchStudentSessionHistory,
    maxAgeMs: 45_000,
  });

  useFocusEffect(
    useCallback(() => {
      void refreshHistory();
      return undefined;
    }, [refreshHistory])
  );

  return (
    <AppScreen contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(tabs)/profile')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <Text style={styles.eyebrow}>SESSION HISTORY</Text>
      </View>

      <SurfaceCard style={styles.heroCard}>
        <View>
          <Text style={styles.title}>Completed Exams</Text>
          <Text style={styles.meta}>{history.length} submitted sessions</Text>
        </View>
      </SurfaceCard>

      {isLoading ? (
        <SurfaceCard style={styles.loadingCard} tone="muted">
          <ActivityIndicator color={colors.teal} size="small" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </SurfaceCard>
      ) : null}

      {errorMessage ? (
        <InlineMessage
          action={
            <ActionButton
              compact
              fullWidth={false}
              label="Retry"
              onPress={() => void refreshHistory({ force: true })}
              tone="danger"
            />
          }
          description={errorMessage}
          style={styles.message}
          tone="danger"
        />
      ) : null}

      {!isLoading && !errorMessage && history.length === 0 ? (
        <InlineMessage
          description="Submitted exam sessions will be listed here."
          style={styles.message}
          title="No completed sessions"
          tone="neutral"
        />
      ) : null}

      <View style={styles.list}>
        {history.map((item) => (
          <Pressable
            key={item.attemptId}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/results',
                params: { examId: item.examId },
              })
            }
            style={({ pressed }) => (pressed ? styles.historyPressed : null)}>
            <SurfaceCard>
              <View style={styles.historyHeader}>
                <View style={styles.historyTitleBlock}>
                  <Text style={styles.courseCode}>{item.courseCode}</Text>
                  <Text style={styles.examTitle}>{item.examTitle}</Text>
                </View>
                <AccentBadge label={`${item.scorePercent}%`} tone={getScoreTone(item.scorePercent)} />
              </View>
              <Text style={styles.courseTitle}>{item.courseTitle}</Text>
              <Text style={styles.submittedAt}>{formatSubmittedAt(item.submittedAt)}</Text>
              <View style={styles.resultRow}>
                <Text style={styles.resultMeta}>
                  {item.correctAnswers} / {item.totalQuestions} correct
                </Text>
                <Text style={styles.integrityText}>INTEGRITY {item.integrity}</Text>
              </View>
              <Text style={styles.remark}>{item.remark}</Text>
            </SurfaceCard>
          </Pressable>
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
    courseCode: {
      color: colors.muted,
      fontSize: type.tiny,
      fontWeight: '700',
      letterSpacing: 0.7,
    },
    courseTitle: {
      color: colors.mutedStrong,
      fontSize: type.body,
      marginTop: 8,
    },
    eyebrow: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    examTitle: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '800',
      marginTop: 6,
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    heroCard: {
      marginTop: 18,
    },
    historyHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
    },
    historyPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.99 }],
    },
    historyTitleBlock: {
      flex: 1,
    },
    integrityText: {
      color: colors.success,
      fontSize: type.tiny,
      fontWeight: '800',
      letterSpacing: 0.5,
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
    remark: {
      color: colors.mutedStrong,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 12,
    },
    resultMeta: {
      color: colors.text,
      fontSize: type.body,
      fontWeight: '700',
    },
    resultRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 14,
    },
    submittedAt: {
      color: colors.muted,
      fontSize: type.tiny,
      marginTop: 10,
    },
    title: {
      color: colors.text,
      fontSize: type.title + 2,
      fontWeight: '800',
    },
  });
}
