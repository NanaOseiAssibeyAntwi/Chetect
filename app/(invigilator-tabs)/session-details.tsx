import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, AccentBadge, InlineMessage, MetricTile, SurfaceCard } from '@/components/product-ui';
import { layout, radius, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  fetchInvigilatorSessionDetails,
  type InvigilatorSessionDetailsData,
} from '@/lib/invigilator-sessions';

function formatDateTime(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.trunc(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${remainingMinutes}m`;
}

function statusTone(status: InvigilatorSessionDetailsData['status']) {
  if (status === 'live') {
    return 'danger' as const;
  }

  if (status === 'completed') {
    return 'success' as const;
  }

  if (status === 'scheduled') {
    return 'warning' as const;
  }

  return 'neutral' as const;
}

function parseMissingStudentIds(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value.join(',') : value ?? '';
  return rawValue
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function InvigilatorSessionDetailsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ examId?: string | string[]; missingStudentIds?: string | string[] }>();
  const examId = useMemo(
    () => (Array.isArray(params.examId) ? params.examId[0] : params.examId) ?? '',
    [params.examId]
  );
  const missingStudentIds = useMemo(
    () => parseMissingStudentIds(params.missingStudentIds),
    [params.missingStudentIds]
  );

  const loadDetails = useCallback(
    () =>
      fetchInvigilatorSessionDetails({
        examIdInput: examId,
        missingStudentIds,
      }),
    [examId, missingStudentIds]
  );
  const {
    data: sessionDetails,
    errorMessage,
    isLoading,
    refresh: refreshSessionDetails,
  } = useCachedResource<InvigilatorSessionDetailsData | null>({
    initialData: null,
    key: `invigilator.session-details.${examId || 'missing'}.${missingStudentIds.join('|')}`,
    loader: loadDetails,
    maxAgeMs: 60_000,
  });

  useEffect(() => {
    void refreshSessionDetails({ showLoader: sessionDetails === null });
  }, [refreshSessionDetails, sessionDetails]);

  const metrics = useMemo(
    () => [
      {
        label: 'REGISTERED',
        value: String(sessionDetails?.registeredCount ?? 0),
      },
      {
        label: 'QUESTIONS',
        value: String(sessionDetails?.questionCount ?? 0),
      },
      {
        label: 'DURATION',
        value: sessionDetails ? formatDuration(sessionDetails.durationMinutes) : '--',
      },
    ],
    [sessionDetails]
  );

  return (
    <AppScreen accent="warning" contentContainerStyle={styles.content} edges={['top']}>
      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Feather color={colors.warning} name="check-circle" size={26} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.eyebrow}>SESSION CREATED</Text>
          <Text style={styles.title}>{sessionDetails?.title ?? 'Exam Session'}</Text>
          <Text style={styles.meta}>
            {sessionDetails
              ? `${sessionDetails.courseCode} - ${sessionDetails.courseTitle}`
              : 'Loading session information...'}
          </Text>
        </View>
        {sessionDetails ? (
          <AccentBadge label={sessionDetails.status.toUpperCase()} tone={statusTone(sessionDetails.status)} />
        ) : null}
      </SurfaceCard>

      {isLoading ? (
        <SurfaceCard style={styles.loadingCard} tone="muted">
          <ActivityIndicator color={colors.warning} size="small" />
          <Text style={styles.loadingText}>Loading session details...</Text>
        </SurfaceCard>
      ) : null}

      {errorMessage ? (
        <InlineMessage
          action={
            <ActionButton
              compact
              fullWidth={false}
              label={sessionDetails ? 'Retry' : 'Back to dashboard'}
              onPress={() =>
                sessionDetails
                  ? void refreshSessionDetails({ force: true })
                  : router.replace('/(invigilator-tabs)')
              }
              tone="danger"
            />
          }
          description={errorMessage}
          style={styles.message}
          tone="danger"
        />
      ) : null}

      {!isLoading && sessionDetails ? (
        <>
          <View style={styles.metricRow}>
            {metrics.map((metric) => (
              <MetricTile
                accentColor={colors.warning}
                key={metric.label}
                label={metric.label}
                style={styles.metricTile}
                value={metric.value}
              />
            ))}
          </View>

          <SurfaceCard style={styles.detailsCard} tone="muted">
            <Text style={styles.sectionLabel}>SESSION INFO</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Starts</Text>
              <Text style={styles.detailValue}>{formatDateTime(sessionDetails.scheduledStart)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ends</Text>
              <Text style={styles.detailValue}>{formatDateTime(sessionDetails.scheduledEnd)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Monitoring</Text>
              <Text style={styles.detailValue}>{sessionDetails.monitoringMode.toUpperCase()}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Capacity</Text>
              <Text style={styles.detailValue}>{sessionDetails.maxStudents} students</Text>
            </View>
          </SurfaceCard>

          {sessionDetails.missingStudentIds.length > 0 ? (
            <InlineMessage
              description={`Missing IDs not found: ${sessionDetails.missingStudentIds.join(', ')}.`}
              style={styles.message}
              title="Some students were not registered"
              tone="warning"
            />
          ) : (
            <InlineMessage
              description="The session is ready and registered students can see it from their student portal."
              style={styles.message}
              title="Ready for students"
              tone="success"
            />
          )}

          <ActionButton
            containerStyle={styles.dashboardButton}
            icon={<Feather color={colors.background} name="home" size={15} />}
            label="Back to Dashboard"
            onPress={() => router.replace('/(invigilator-tabs)')}
            tone="accent"
          />
        </>
      ) : null}
    </AppScreen>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    content: {
      paddingBottom: layout.bottomPadding,
    },
    dashboardButton: {
      marginTop: 18,
    },
    detailLabel: {
      color: colors.muted,
      flex: 0.42,
      fontSize: type.body,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    detailRow: {
      alignItems: 'flex-start',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 13,
    },
    detailsCard: {
      marginTop: 16,
    },
    detailValue: {
      color: colors.text,
      flex: 1,
      fontSize: type.body,
      fontWeight: '700',
      textAlign: 'right',
    },
    eyebrow: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    heroCard: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 54,
      justifyContent: 'center',
      width: 54,
    },
    heroText: {
      flex: 1,
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
      lineHeight: 20,
      marginTop: 6,
    },
    metricRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 16,
    },
    metricTile: {
      minHeight: 70,
      paddingHorizontal: 10,
    },
    sectionLabel: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.text,
      fontSize: type.title + 2,
      fontWeight: '900',
      marginTop: 7,
    },
  });
}
