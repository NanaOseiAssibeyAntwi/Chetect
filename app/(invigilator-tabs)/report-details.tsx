import { Feather } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, AccentBadge, InlineMessage, MetricTile, SurfaceCard } from '@/components/product-ui';
import { font, layout, radius, shadow, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  fetchInvigilatorReportDetails,
  type InvigilatorReportDetailsData,
  type InvigilatorSuspiciousEvent,
  type MonitorRiskLevel,
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

function formatSeconds(value: number) {
  const safe = Math.max(0, Math.trunc(value));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatPreciseSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return '00:00.00';
  }

  const safe = Math.max(0, value);
  const minutes = Math.floor(safe / 60);
  const seconds = (safe % 60).toFixed(2).padStart(5, '0');
  return `${String(minutes).padStart(2, '0')}:${seconds}`;
}

function statusTone(status: InvigilatorReportDetailsData['status']) {
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

function getRiskPresentation(riskLevel: MonitorRiskLevel, colors: ReturnType<typeof useAppTheme>['colors']) {
  if (riskLevel === 'critical') {
    return { color: colors.danger, label: 'CRIT' };
  }

  if (riskLevel === 'high') {
    return { color: colors.danger, label: 'HIGH' };
  }

  if (riskLevel === 'medium') {
    return { color: colors.warning, label: 'MED' };
  }

  return { color: colors.success, label: 'LOW' };
}

function getSegmentRoleLabel(role: InvigilatorSuspiciousEvent['segments'][number]['role']) {
  if (role === 'event') {
    return 'EVENT';
  }

  if (role === 'context-before') {
    return 'CONTEXT BEFORE';
  }

  if (role === 'context-after') {
    return 'CONTEXT AFTER';
  }

  return 'CONTEXT';
}

function toClipKey(eventId: string, segmentPath: string) {
  return `${eventId}-${segmentPath}`;
}

function toClipCachePath(eventId: string, segmentPath: string) {
  const cacheRoot = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
  if (!cacheRoot) {
    return null;
  }

  const segmentWithoutQuery = segmentPath.split('?')[0] ?? segmentPath;
  const extensionMatch = /\.[a-z0-9]+$/i.exec(segmentWithoutQuery);
  const extension = extensionMatch?.[0]?.toLowerCase() ?? '.mp4';
  const safeToken = `${eventId}-${segmentPath}`.replace(/[^a-z0-9_-]/gi, '_').slice(0, 120);
  return `${cacheRoot}suspicious-report-${safeToken}${extension}`;
}

function toPlaybackErrorText(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (value && typeof value === 'object') {
    try {
      const asJson = JSON.stringify(value);
      if (asJson && asJson !== '{}') {
        return asJson;
      }
    } catch {
      // Fall through to the generic error.
    }
  }

  return 'Unknown playback error';
}

export default function InvigilatorReportDetailsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ examId?: string | string[] }>();
  const examId = useMemo(
    () => (Array.isArray(params.examId) ? params.examId[0] : params.examId) ?? '',
    [params.examId]
  );

  const loadReportDetails = useCallback(() => fetchInvigilatorReportDetails(examId), [examId]);
  const {
    data: reportDetails,
    errorMessage,
    isLoading,
    refresh: refreshReportDetails,
  } = useCachedResource<InvigilatorReportDetailsData | null>({
    initialData: null,
    key: `invigilator.report-details.${examId || 'missing'}`,
    loader: loadReportDetails,
    maxAgeMs: 60_000,
  });
  const [openEventId, setOpenEventId] = useState('');
  const [clipPlaybackErrors, setClipPlaybackErrors] = useState<Record<string, string>>({});
  const [clipLocalUris, setClipLocalUris] = useState<Record<string, string>>({});
  const [clipDownloadsInProgress, setClipDownloadsInProgress] = useState<Record<string, boolean>>({});
  const clipLocalUrisRef = useRef<Record<string, string>>({});
  const clipDownloadsInProgressRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    clipLocalUrisRef.current = clipLocalUris;
  }, [clipLocalUris]);

  useEffect(() => {
    clipDownloadsInProgressRef.current = clipDownloadsInProgress;
  }, [clipDownloadsInProgress]);

  useEffect(() => {
    setClipPlaybackErrors({});
    setClipLocalUris({});
    setClipDownloadsInProgress({});
  }, [examId]);

  useEffect(() => {
    void refreshReportDetails({ showLoader: reportDetails === null });
  }, [refreshReportDetails, reportDetails]);

  useEffect(() => {
    if (!reportDetails) {
      setOpenEventId('');
      return;
    }

    setOpenEventId((current) => {
      if (current && reportDetails.suspiciousEvents.some((eventRow) => eventRow.id === current)) {
        return current;
      }

      return reportDetails.suspiciousEvents[0]?.id ?? '';
    });
  }, [reportDetails]);

  useEffect(() => {
    if (!openEventId) {
      return;
    }

    const openEvent = reportDetails?.suspiciousEvents.find((eventRow) => eventRow.id === openEventId);
    if (!openEvent || openEvent.segments.length === 0) {
      return;
    }

    let cancelled = false;

    const ensureLocalClipCopies = async () => {
      for (const segment of openEvent.segments) {
        if (!segment.videoUrl) {
          continue;
        }

        const clipKey = toClipKey(openEvent.id, segment.path);
        if (clipLocalUrisRef.current[clipKey] || clipDownloadsInProgressRef.current[clipKey]) {
          continue;
        }

        setClipDownloadsInProgress((current) => ({
          ...current,
          [clipKey]: true,
        }));

        try {
          const cachePath = toClipCachePath(openEvent.id, segment.path);
          if (!cachePath) {
            throw new Error('Local cache path is unavailable on this device.');
          }

          const existing = await FileSystem.getInfoAsync(cachePath);
          if (!existing.exists || existing.isDirectory) {
            await FileSystem.downloadAsync(segment.videoUrl, cachePath);
          }

          if (cancelled) {
            return;
          }

          setClipLocalUris((current) => ({
            ...current,
            [clipKey]: cachePath,
          }));
        } catch (error) {
          if (cancelled) {
            return;
          }

          setClipPlaybackErrors((current) => ({
            ...current,
            [clipKey]: `Unable to download this clip for local playback: ${toPlaybackErrorText(error)}`,
          }));
        } finally {
          if (cancelled) {
            return;
          }

          setClipDownloadsInProgress((current) => {
            const next = { ...current };
            delete next[clipKey];
            return next;
          });
        }
      }
    };

    void ensureLocalClipCopies();

    return () => {
      cancelled = true;
    };
  }, [openEventId, reportDetails?.suspiciousEvents]);

  const metrics = useMemo(
    () => [
      {
        label: 'ACTIVITY',
        value: String(reportDetails?.suspiciousEventCount ?? 0),
        valueColor: colors.warning,
      },
      {
        label: 'TRUST',
        value: `${reportDetails?.integrityScore ?? 100}`,
        valueColor: colors.success,
      },
      {
        label: 'REGISTERED',
        value: String(reportDetails?.registeredStudents ?? 0),
        valueColor: colors.text,
      },
    ],
    [colors, reportDetails]
  );

  return (
    <AppScreen accent="warning" contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.navigate('/(invigilator-tabs)/reports')}
          style={({ pressed }) => [styles.backButton, pressed ? styles.buttonPressed : null]}>
          <Feather color={colors.warning} name="chevron-left" size={17} />
          <Text style={styles.backButtonText}>Reports</Text>
        </Pressable>
        <Text style={styles.eyebrow}>REPORT DETAILS</Text>
      </View>

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Feather color={colors.warning} name="file-text" size={25} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.courseCode}>{reportDetails?.courseCode ?? 'COURSE'}</Text>
          <Text style={styles.title}>{reportDetails?.title ?? 'Exam Report'}</Text>
          <Text style={styles.meta}>
            {reportDetails?.courseTitle ?? 'Loading report information...'}
          </Text>
        </View>
        {reportDetails ? (
          <AccentBadge label={reportDetails.status.toUpperCase()} tone={statusTone(reportDetails.status)} />
        ) : null}
      </SurfaceCard>

      {isLoading ? (
        <SurfaceCard style={styles.loadingCard} tone="muted">
          <ActivityIndicator color={colors.warning} size="small" />
          <Text style={styles.loadingText}>Loading report details...</Text>
        </SurfaceCard>
      ) : null}

      {errorMessage ? (
        <InlineMessage
          action={
            <ActionButton
              compact
              fullWidth={false}
              label={reportDetails ? 'Retry' : 'Back to reports'}
              onPress={() =>
                reportDetails
                  ? void refreshReportDetails({ force: true })
                  : router.navigate('/(invigilator-tabs)/reports')
              }
              tone="danger"
            />
          }
          description={errorMessage}
          style={styles.message}
          tone="danger"
        />
      ) : null}

      {!isLoading && reportDetails ? (
        <>
          <View style={styles.metricRow}>
            {metrics.map((metric) => (
              <MetricTile
                accentColor={metric.valueColor}
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
              <Text style={styles.detailLabel}>Started</Text>
              <Text style={styles.detailValue}>{formatDateTime(reportDetails.scheduledStart)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ended</Text>
              <Text style={styles.detailValue}>{formatDateTime(reportDetails.scheduledEnd)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duration</Text>
              <Text style={styles.detailValue}>{formatDuration(reportDetails.durationMinutes)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Monitoring</Text>
              <Text style={styles.detailValue}>{reportDetails.monitoringMode.toUpperCase()}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Questions</Text>
              <Text style={styles.detailValue}>{reportDetails.questionCount}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Capacity</Text>
              <Text style={styles.detailValue}>{reportDetails.maxStudents} students</Text>
            </View>
          </SurfaceCard>

          <View style={styles.eventsHeader}>
            <Text style={styles.sectionLabel}>PAST SUSPICIOUS ACTIVITY</Text>
            <Text style={styles.eventsCount}>{reportDetails.suspiciousEvents.length} flags</Text>
          </View>

          {reportDetails.suspiciousEvents.length === 0 ? (
            <InlineMessage
              description="No suspicious activity recordings were stored for this completed session."
              style={styles.message}
              title="No evidence clips"
              tone="neutral"
            />
          ) : (
            <View style={styles.eventsList}>
              {reportDetails.suspiciousEvents.map((eventRow) => {
                const isOpen = openEventId === eventRow.id;
                const risk = getRiskPresentation(eventRow.riskLevel, colors);

                return (
                  <SurfaceCard key={eventRow.id} style={styles.eventCard} tone="muted">
                    <View style={styles.eventHeader}>
                      <View style={styles.eventHeaderLeft}>
                        <View
                          style={[
                            styles.levelBadge,
                            {
                              backgroundColor: `${risk.color}20`,
                              borderColor: `${risk.color}60`,
                            },
                          ]}>
                          <Text style={[styles.levelText, { color: risk.color }]}>{risk.label}</Text>
                        </View>
                        <View style={styles.eventStudentBlock}>
                          <Text style={styles.eventStudent}>{eventRow.studentName}</Text>
                          <Text style={styles.eventStudentId}>{eventRow.studentInstitutionalId}</Text>
                        </View>
                      </View>
                      <Text style={styles.eventTime}>{formatDateTime(eventRow.createdAt)}</Text>
                    </View>

                    <Text style={styles.eventReason}>{eventRow.reason}</Text>
                    <Text style={styles.eventMeta}>
                      ALERT {formatPreciseSeconds(eventRow.startTimestampSeconds)} -{' '}
                      {formatPreciseSeconds(eventRow.endTimestampSeconds)} | SCORE{' '}
                      {Math.round(eventRow.maxScore)}
                    </Text>
                    <Text style={styles.eventMeta}>
                      {eventRow.severity ? `SEVERITY ${eventRow.severity.toUpperCase()} | ` : ''}
                      {eventRow.signalCode ? `SIGNAL ${eventRow.signalCode} | ` : ''}
                      SEGMENTS {eventRow.segments.length}
                    </Text>

                    <Pressable
                      onPress={() => setOpenEventId((current) => (current === eventRow.id ? '' : eventRow.id))}
                      style={styles.clipToggleButton}>
                      <Text style={styles.clipToggleText}>
                        {isOpen ? 'Hide recordings' : 'View recordings'}
                      </Text>
                    </Pressable>

                    {isOpen ? (
                      <View style={styles.clipList}>
                        {eventRow.segments.length === 0 ? (
                          <Text style={styles.clipWaitingText}>No video segment is attached to this activity.</Text>
                        ) : (
                          eventRow.segments.map((segment, index) => {
                            const clipKey = toClipKey(eventRow.id, segment.path);
                            const localClipUri = clipLocalUris[clipKey] ?? null;
                            const clipDownloadError = clipPlaybackErrors[clipKey] ?? '';
                            const isDownloading =
                              Boolean(clipDownloadsInProgress[clipKey]) && !localClipUri;

                            return (
                              <View key={`${eventRow.id}-${segment.path}-${index}`} style={styles.segmentCard}>
                                <Text style={styles.segmentMeta}>
                                  Segment {index + 1} - {formatDateTime(segment.startedAtIso)}
                                </Text>
                                <Text style={styles.segmentMeta}>
                                  Focus {getSegmentRoleLabel(segment.role)} | Duration{' '}
                                  {formatSeconds(segment.durationSeconds)}
                                </Text>
                                {localClipUri ? (
                                  <>
                                    <Video
                                      isLooping
                                      onError={(error) =>
                                        setClipPlaybackErrors((current) => ({
                                          ...current,
                                          [clipKey]: toPlaybackErrorText(error),
                                        }))
                                      }
                                      resizeMode={ResizeMode.CONTAIN}
                                      shouldPlay={segment.role === 'event' && index === 0}
                                      source={{ uri: localClipUri }}
                                      style={styles.segmentVideo}
                                      useNativeControls
                                    />
                                    {clipDownloadError ? (
                                      <Text style={styles.clipErrorText}>
                                        Unable to play this clip: {clipDownloadError}
                                      </Text>
                                    ) : null}
                                  </>
                                ) : null}
                                {!localClipUri && isDownloading ? (
                                  <Text style={styles.clipWaitingText}>
                                    Preparing secure clip playback...
                                  </Text>
                                ) : null}
                                {!localClipUri && !isDownloading && clipDownloadError ? (
                                  <Text style={styles.clipErrorText}>
                                    Unable to play this clip: {clipDownloadError}
                                  </Text>
                                ) : null}
                                {!localClipUri && !isDownloading && !clipDownloadError ? (
                                  <Text style={styles.clipWaitingText}>Clip download is pending...</Text>
                                ) : null}
                              </View>
                            );
                          })
                        )}
                      </View>
                    ) : null}
                  </SurfaceCard>
                );
              })}
            </View>
          )}
        </>
      ) : null}
    </AppScreen>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    backButton: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.warningSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 5,
      minHeight: 38,
      justifyContent: 'center',
      paddingHorizontal: 12,
      ...shadow.card,
    },
    backButtonText: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
    },
    buttonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.985 }],
    },
    clipErrorText: {
      color: colors.danger,
      fontFamily: font.body,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 8,
    },
    clipList: {
      gap: 8,
      marginTop: 10,
    },
    clipToggleButton: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.md,
      borderWidth: 1.5,
      marginTop: 12,
      paddingVertical: 11,
    },
    clipToggleText: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
    },
    clipWaitingText: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 6,
    },
    content: {
      paddingBottom: layout.bottomPadding,
    },
    courseCode: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    detailLabel: {
      color: colors.muted,
      flex: 0.42,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
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
      borderLeftColor: colors.warning,
      borderLeftWidth: 4,
      marginTop: 16,
    },
    detailValue: {
      color: colors.text,
      flex: 1,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
      textAlign: 'right',
    },
    eventCard: {
      borderLeftColor: colors.warning,
      borderLeftWidth: 3,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    eventHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    eventHeaderLeft: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: 8,
    },
    eventMeta: {
      color: colors.muted,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '800',
      letterSpacing: 0.4,
      marginTop: 6,
      textTransform: 'uppercase',
    },
    eventReason: {
      color: colors.text,
      fontFamily: font.body,
      fontSize: type.bodyLarge,
      fontWeight: '800',
      lineHeight: 21,
      marginTop: 12,
    },
    eventsCount: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
    },
    eventsHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
      marginTop: 20,
    },
    eventsList: {
      gap: 10,
    },
    eventStudent: {
      color: colors.text,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
    },
    eventStudentBlock: {
      flex: 1,
    },
    eventStudentId: {
      color: colors.muted,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '800',
      marginTop: 3,
    },
    eventTime: {
      color: colors.muted,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '800',
      textAlign: 'right',
    },
    eyebrow: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.label,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    heroCard: {
      alignItems: 'center',
      borderColor: colors.borderStrong,
      flexDirection: 'row',
      gap: 14,
      marginTop: 18,
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
    },
    levelBadge: {
      borderRadius: radius.pill,
      borderWidth: 1.5,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    levelText: {
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.8,
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
    meta: {
      color: colors.mutedStrong,
      fontFamily: font.body,
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
      fontFamily: font.body,
      fontSize: type.label,
      fontWeight: '900',
      letterSpacing: 0.8,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    segmentCard: {
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    segmentMeta: {
      color: colors.muted,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '800',
      letterSpacing: 0.4,
      marginBottom: 4,
    },
    segmentVideo: {
      backgroundColor: colors.text,
      borderRadius: radius.sm,
      height: 176,
      marginTop: 6,
      width: '100%',
    },
    title: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.display,
      fontWeight: '900',
      lineHeight: type.display + 5,
      marginTop: 7,
    },
  });
}
