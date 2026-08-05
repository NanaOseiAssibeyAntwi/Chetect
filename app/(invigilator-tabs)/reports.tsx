import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, AccentBadge, InlineMessage, MetricTile, SectionIntro, SurfaceCard } from '@/components/product-ui';
import { layout, radius, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  fetchInvigilatorReports,
  type InvigilatorReportSummaryItem,
  type InvigilatorReportsData,
} from '@/lib/invigilator-sessions';

function formatReportDate(isoDate: string) {
  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unknown date';
  }

  return parsedDate.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusTone(status: InvigilatorReportSummaryItem['status']) {
  if (status === 'completed') {
    return 'success' as const;
  }

  if (status === 'live') {
    return 'danger' as const;
  }

  if (status === 'scheduled') {
    return 'warning' as const;
  }

  return 'neutral' as const;
}

export default function InvigilatorReportsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [reportsData, setReportsData] = useState<InvigilatorReportsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await fetchInvigilatorReports();
      setReportsData(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load reports.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReports();
      return undefined;
    }, [loadReports])
  );

  const summary = useMemo(
    () =>
      [
        { label: 'SESSIONS', value: String(reportsData?.stats.sessions ?? 0), valueColor: colors.warning },
        { label: 'AVG TRUST', value: `${reportsData?.stats.averageTrust ?? 100}`, valueColor: colors.success },
        { label: 'FLAGS', value: String(reportsData?.stats.flagged ?? 0), valueColor: colors.danger },
      ] as const,
    [colors, reportsData]
  );

  const reports = reportsData?.reports ?? [];

  return (
    <AppScreen accent="warning">
      <SectionIntro
        eyebrow="SESSION REPORTS"
        subtitle="Review completed session summaries, integrity scores, and flagged incidents across active courses."
        title="Exam Oversight Reports"
      />

      <SurfaceCard style={styles.trustHero}>
        <View style={styles.trustHeroIcon}>
          <MaterialCommunityIcons color={colors.success} name="shield-check-outline" size={26} />
        </View>
        <View style={styles.trustHeroText}>
          <Text style={styles.trustHeroLabel}>OVERALL INTEGRITY SCORE</Text>
          <Text style={styles.trustHeroValue}>{reportsData?.stats.averageTrust ?? 100}%</Text>
          <Text style={styles.trustHeroCaption}>Average across completed sessions</Text>
        </View>
      </SurfaceCard>

      <View style={styles.summaryRow}>
        {summary.map((item) => (
          <MetricTile
            accentColor={item.valueColor}
            key={item.label}
            label={item.label}
            value={item.value}
          />
        ))}
      </View>

      {isLoading ? (
        <SurfaceCard style={styles.loadingCard} tone="muted">
          <ActivityIndicator color={colors.warning} size="small" />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </SurfaceCard>
      ) : null}

      {errorMessage ? (
        <InlineMessage
          action={
            <ActionButton
              compact
              fullWidth={false}
              label="Retry"
              onPress={() => void loadReports()}
              tone="danger"
            />
          }
          description={errorMessage}
          style={styles.message}
          tone="danger"
        />
      ) : null}

      {!isLoading && !errorMessage && reports.length === 0 ? (
        <InlineMessage
          description="Completed course sessions with suspicious activity evidence will appear here."
          style={styles.message}
          title="No completed reports"
          tone="neutral"
        />
      ) : null}

      <View style={styles.list}>
        {reports.map((report) => (
          <Pressable
            key={report.examId}
            onPress={() =>
              router.push({
                pathname: '/(invigilator-tabs)/report-details',
                params: { examId: report.examId },
              })
            }
            style={({ pressed }) => [styles.reportPressable, pressed ? styles.reportPressed : null]}>
            <SurfaceCard>
              <View style={styles.reportHeader}>
                <View style={styles.reportTitleBlock}>
                  <Text style={styles.reportCourse}>{report.courseTitle}</Text>
                  <Text style={styles.reportCode}>{report.courseCode}</Text>
                  <Text style={styles.reportDate}>{formatReportDate(report.scheduledEnd)}</Text>
                </View>
                <View style={styles.reportStatusBlock}>
                  <AccentBadge label={report.status.toUpperCase()} tone={getStatusTone(report.status)} />
                  <Feather color={colors.mutedStrong} name="chevron-right" size={18} />
                </View>
              </View>

              <View style={styles.reportFooter}>
                <View style={styles.reportMeta}>
                  <MaterialCommunityIcons color={colors.warning} name="alert-outline" size={16} />
                  <Text style={styles.flagsText}>
                    {report.suspiciousEventCount}{' '}
                    {report.suspiciousEventCount === 1 ? 'activity' : 'activities'}
                  </Text>
                </View>
                <Text style={styles.integrityText}>TRUST {report.integrityScore}</Text>
              </View>
            </SurfaceCard>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    flagsText: {
      color: colors.warning,
      fontSize: 13,
      fontWeight: '700',
    },
    integrityText: {
      color: colors.success,
      fontSize: 13,
      fontWeight: '700',
    },
    list: {
      gap: 12,
      marginTop: layout.sectionGap,
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
    reportCode: {
      color: colors.muted,
      fontSize: type.label,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginTop: 6,
      textTransform: 'uppercase',
    },
    reportCourse: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '700',
    },
    reportDate: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 8,
    },
    reportFooter: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    reportHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
    },
    reportMeta: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    reportPressable: {
      borderRadius: radius.md,
    },
    reportPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.99 }],
    },
    reportStatusBlock: {
      alignItems: 'flex-end',
      gap: 12,
    },
    reportTitleBlock: {
      flex: 1,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: layout.cardGap,
      marginTop: layout.sectionGap,
    },
    trustHero: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 16,
      marginTop: layout.sectionGap,
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    trustHeroCaption: {
      color: colors.mutedStrong,
      fontSize: type.body,
      marginTop: 4,
    },
    trustHeroIcon: {
      alignItems: 'center',
      backgroundColor: colors.successSoft,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
    trustHeroLabel: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '800',
      letterSpacing: 1,
    },
    trustHeroText: {
      flex: 1,
    },
    trustHeroValue: {
      color: colors.text,
      fontSize: type.display + 6,
      fontWeight: '900',
      marginTop: 2,
    },
  });
}
