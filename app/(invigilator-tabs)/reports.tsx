import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, AccentBadge, InlineMessage, MetricTile, SurfaceCard } from '@/components/product-ui';
import { font, layout, radius, shadow, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
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

  const {
    data: reportsData,
    errorMessage,
    isLoading,
    refresh: refreshReports,
  } = useCachedResource<InvigilatorReportsData | null>({
    initialData: null,
    key: 'invigilator.reports',
    loader: fetchInvigilatorReports,
    maxAgeMs: 30_000,
  });

  useFocusEffect(
    useCallback(() => {
      void refreshReports({ showLoader: reportsData === null });
      return undefined;
    }, [refreshReports, reportsData])
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
    <AppScreen accent="warning" contentContainerStyle={styles.content}>
      <View style={styles.heroHeader}>
        <View style={styles.heroText}>
          <View style={styles.heroBadge}>
            <View style={styles.heroBadgeDot} />
            <Text style={styles.heroBadgeText}>SESSION REPORTS</Text>
          </View>
          <Text style={styles.heroTitle}>Exam Oversight Reports</Text>
          <Text style={styles.heroCopy}>Review integrity scores and flagged incidents across sessions.</Text>
        </View>
        <View style={styles.heroIcon}>
          <Feather color={colors.warning} name="file-text" size={25} />
        </View>
      </View>

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
              onPress={() => void refreshReports({ force: true })}
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
            <SurfaceCard style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <View style={styles.reportTitleBlock}>
                  <Text style={styles.reportCode}>{report.courseCode}</Text>
                  <Text style={styles.reportCourse}>{report.courseTitle}</Text>
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
    content: {
      paddingTop: 4,
    },
    flagsText: {
      color: colors.danger,
      fontFamily: font.body,
      fontSize: 13,
      fontWeight: '900',
    },
    heroBadge: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    heroBadgeDot: {
      backgroundColor: colors.warning,
      borderRadius: radius.pill,
      height: 7,
      width: 7,
    },
    heroBadgeText: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: type.label,
      fontWeight: '900',
      letterSpacing: 1,
    },
    heroCopy: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 7,
    },
    heroHeader: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
      ...shadow.raised,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 54,
      justifyContent: 'center',
      width: 54,
    },
    heroText: {
      flex: 1,
      minWidth: 0,
    },
    heroTitle: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.display,
      fontWeight: '900',
      lineHeight: type.display + 5,
      marginTop: 12,
    },
    integrityText: {
      color: colors.success,
      fontFamily: font.body,
      fontSize: 13,
      fontWeight: '900',
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
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '700',
    },
    message: {
      marginTop: 14,
    },
    reportCode: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    reportCourse: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.title,
      fontWeight: '900',
      lineHeight: 23,
      marginTop: 7,
    },
    reportCard: {
      borderLeftColor: colors.warning,
      borderLeftWidth: 4,
    },
    reportDate: {
      color: colors.muted,
      fontFamily: font.body,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 8,
    },
    reportFooter: {
      alignItems: 'center',
      borderTopColor: colors.borderSoft,
      borderTopWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 14,
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
      marginTop: 16,
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    trustHeroCaption: {
      color: colors.mutedStrong,
      fontFamily: font.body,
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
      fontFamily: font.body,
      fontSize: type.label,
      fontWeight: '900',
      letterSpacing: 1,
    },
    trustHeroText: {
      flex: 1,
    },
    trustHeroValue: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.display + 6,
      fontWeight: '900',
      marginTop: 2,
    },
  });
}
