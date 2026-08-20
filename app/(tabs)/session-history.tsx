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

function getScoreColor(scorePercent: number, colors: ReturnType<typeof useAppTheme>['colors']) {
  if (scorePercent >= 70) {
    return colors.success;
  }

  if (scorePercent >= 50) {
    return colors.warning;
  }

  return colors.danger;
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
    <AppScreen accent="teal" contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(tabs)/profile')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>SESSION HISTORY</Text>
          <Text style={styles.headerTitle}>Completed exams</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons color={colors.teal} name="file-document-check-outline" size={24} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>Result archive</Text>
          <Text style={styles.meta}>{history.length} submitted sessions</Text>
        </View>
      </View>

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
        {history.map((item) => {
          const scoreColor = getScoreColor(item.scorePercent, colors);

          return (
            <Pressable
              key={item.attemptId}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/results',
                  params: { examId: item.examId },
                })
              }
              style={({ pressed }) => [styles.historyCard, pressed ? styles.historyPressed : null]}>
              <View style={styles.historyHeader}>
                <View style={styles.courseBadge}>
                  <Text numberOfLines={1} style={styles.courseCode}>{item.courseCode}</Text>
                </View>
                <View style={[styles.scoreBadge, { borderColor: scoreColor }]}>
                  <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>{item.scorePercent}%</Text>
                </View>
              </View>
              <Text numberOfLines={2} style={styles.examTitle}>{item.examTitle}</Text>
              <Text numberOfLines={1} style={styles.courseTitle}>{item.courseTitle}</Text>
              <Text style={styles.submittedAt}>{formatSubmittedAt(item.submittedAt)}</Text>
              <View style={styles.resultRow}>
                <Text style={styles.resultMeta}>{item.correctAnswers} / {item.totalQuestions} correct</Text>
                <Text style={styles.integrityText}>INTEGRITY {item.integrity}</Text>
              </View>
              <Text numberOfLines={2} style={styles.remark}>{item.remark}</Text>
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
    courseBadge: {
      backgroundColor: colors.tealSoft,
      borderColor: colors.tealGlow,
      borderRadius: radius.pill,
      borderWidth: 1,
      maxWidth: '58%',
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    courseCode: {
      color: colors.teal,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.7,
    },
    courseTitle: {
      color: colors.mutedStrong,
      fontSize: type.body,
      marginTop: 7,
    },
    eyebrow: {
      color: colors.teal,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    examTitle: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '900',
      lineHeight: 24,
      marginTop: 12,
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
    },
    historyCard: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderLeftColor: colors.teal,
      borderLeftWidth: 3,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 14,
      ...shadow.card,
    },
    historyHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
    },
    historyPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.99 }],
    },
    integrityText: {
      color: colors.success,
      fontSize: type.tiny,
      fontWeight: '900',
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
      marginTop: 5,
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
      fontWeight: '900',
    },
    resultRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      marginTop: 14,
    },
    scoreBadge: {
      backgroundColor: colors.panelSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    scoreBadgeText: {
      fontSize: type.body,
      fontWeight: '900',
    },
    submittedAt: {
      color: colors.muted,
      fontSize: type.tiny,
      marginTop: 10,
    },
    title: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '900',
    },
  });
}
