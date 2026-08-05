import { Feather } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { layout, radius, shadow, type } from '@/constants/design';
import { ActionButton, InlineMessage, MetricTile } from '@/components/product-ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  fetchInvigilatorMonitorData,
  fetchInvigilatorSuspiciousEvents,
  type InvigilatorMonitorData,
  type InvigilatorMonitorStudent,
  type InvigilatorSuspiciousEvent,
  type MonitorRiskLevel,
} from '@/lib/invigilator-sessions';
import { supabase } from '@/lib/supabase';

const filters = ['all', 'flagged', 'critical'] as const;
type MonitorFilter = (typeof filters)[number];

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

function getExamStatusLabel(status: InvigilatorMonitorData['examStatus']) {
  if (status === 'live') {
    return 'LIVE';
  }

  if (status === 'scheduled') {
    return 'SCHEDULED';
  }

  if (status === 'completed') {
    return 'COMPLETED';
  }

  return status.toUpperCase();
}

function getExamStatusColor(
  status: InvigilatorMonitorData['examStatus'],
  colors: ReturnType<typeof useAppTheme>['colors']
) {
  if (status === 'live') {
    return colors.danger;
  }

  if (status === 'scheduled') {
    return colors.warning;
  }

  if (status === 'completed') {
    return colors.success;
  }

  return colors.muted;
}

function getFilterLabel(filter: MonitorFilter) {
  return filter.toUpperCase();
}

function applyFilter(students: InvigilatorMonitorStudent[], filter: MonitorFilter) {
  if (filter === 'flagged') {
    return students.filter((student) => student.isFlagged);
  }

  if (filter === 'critical') {
    return students.filter((student) => student.isCritical);
  }

  return students;
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

function formatAlertDurationSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return '0.00s';
  }

  return `${Math.max(0, value).toFixed(2)}s`;
}

function formatTimestamp(isoInput: string) {
  const timestamp = new Date(isoInput);
  if (Number.isNaN(timestamp.getTime())) {
    return 'Unknown time';
  }

  return timestamp.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
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
  return `${cacheRoot}suspicious-${safeToken}${extension}`;
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

function getSegmentRoleLabel(role: 'event' | 'context-before' | 'context-after' | 'context') {
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

export default function InvigilatorMonitorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ examId?: string | string[] }>();
  const examId = useMemo(
    () => (Array.isArray(params.examId) ? params.examId[0] : params.examId) ?? '',
    [params.examId]
  );
  const [monitorData, setMonitorData] = useState<InvigilatorMonitorData | null>(null);
  const [activeFilter, setActiveFilter] = useState<MonitorFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [suspiciousEvents, setSuspiciousEvents] = useState<InvigilatorSuspiciousEvent[]>([]);
  const [openEventId, setOpenEventId] = useState('');
  const [clipPlaybackErrors, setClipPlaybackErrors] = useState<Record<string, string>>({});
  const [clipLocalUris, setClipLocalUris] = useState<Record<string, string>>({});
  const [clipDownloadsInProgress, setClipDownloadsInProgress] = useState<Record<string, boolean>>({});
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipLocalUrisRef = useRef<Record<string, string>>({});
  const clipDownloadsInProgressRef = useRef<Record<string, boolean>>({});

  const loadAll = useCallback(
    async (showLoading = true) => {
      if (!examId) {
        setMonitorData(null);
        setSuspiciousEvents([]);
        setErrorMessage('Open a session from the dashboard to monitor students.');
        setIsLoading(false);
        setIsEventsLoading(false);
        return;
      }

      if (showLoading) {
        setIsLoading(true);
        setIsEventsLoading(true);
      }

      setErrorMessage('');

      try {
        const [monitorResult, eventsResult] = await Promise.all([
          fetchInvigilatorMonitorData(examId),
          fetchInvigilatorSuspiciousEvents(examId),
        ]);
        setMonitorData(monitorResult);
        setSuspiciousEvents(eventsResult);
        setClipPlaybackErrors({});
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load monitor data.');
      } finally {
        setIsLoading(false);
        setIsEventsLoading(false);
      }
    },
    [examId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadAll(true);
      return undefined;
    }, [loadAll])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadAll(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAll]);

  useEffect(() => {
    clipLocalUrisRef.current = clipLocalUris;
  }, [clipLocalUris]);

  useEffect(() => {
    clipDownloadsInProgressRef.current = clipDownloadsInProgress;
  }, [clipDownloadsInProgress]);

  useEffect(() => {
    setOpenEventId('');
    setClipPlaybackErrors({});
    setClipLocalUris({});
    setClipDownloadsInProgress({});
  }, [examId]);

  useEffect(() => {
    if (!openEventId) {
      return;
    }

    const openEvent = suspiciousEvents.find((eventRow) => eventRow.id === openEventId);
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
  }, [openEventId, suspiciousEvents]);

  useEffect(() => {
    if (!examId) {
      return;
    }

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(() => {
        void loadAll(false);
      }, 300);
    };

    const channel = supabase
      .channel(`invigilator-monitor-${examId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          filter: `exam_id=eq.${examId}`,
          schema: 'public',
          table: 'analysis_sessions',
        },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          filter: `exam_id=eq.${examId}`,
          schema: 'public',
          table: 'suspicious_events',
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [examId, loadAll]);

  const filteredStudents = useMemo(
    () => applyFilter(monitorData?.students ?? [], activeFilter),
    [activeFilter, monitorData?.students]
  );

  const statusLabel = monitorData ? getExamStatusLabel(monitorData.examStatus) : 'SESSION';
  const statusColor = monitorData ? getExamStatusColor(monitorData.examStatus, colors) : colors.muted;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
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
        <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.navigate('/(invigilator-tabs)')}
            style={styles.backButton}>
            <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.courseCode}>{monitorData?.courseCode ?? 'COURSE'}</Text>
            <Text style={styles.courseTitle}>{monitorData?.title ?? 'Exam Session'}</Text>
          </View>
          <View style={[styles.liveWrap, { backgroundColor: `${statusColor}16`, borderColor: `${statusColor}40` }]}>
            <View style={[styles.liveDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.liveText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <MetricTile
            accentColor={colors.text}
            label="Total"
            style={styles.statTile}
            value={String(monitorData?.stats.total ?? 0)}
          />
          <MetricTile
            accentColor={colors.success}
            label="Active"
            style={styles.statTile}
            value={String(monitorData?.stats.active ?? 0)}
          />
          <MetricTile
            accentColor={colors.warning}
            label="Flagged"
            style={styles.statTile}
            value={String(monitorData?.stats.flagged ?? 0)}
          />
          <MetricTile
            accentColor={colors.mutedStrong}
            label="Done"
            style={styles.statTile}
            value={String(monitorData?.stats.done ?? 0)}
          />
        </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.teal} size="small" />
            <Text style={styles.loadingText}>Loading monitor feed...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <InlineMessage
            action={
              <ActionButton
                compact
                fullWidth={false}
                label="Retry"
                onPress={() => void loadAll(true)}
                tone="danger"
              />
            }
            description={errorMessage}
            style={styles.errorCard}
            tone="danger"
          />
        ) : null}

        <View style={styles.filterRow}>
          {filters.map((filter) => {
            const active = activeFilter === filter;

            return (
              <Pressable
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={[styles.filterItem, active ? styles.filterItemActive : null]}>
                <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>
                  {getFilterLabel(filter)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {filteredStudents.length === 0 && !isLoading && !errorMessage ? (
          <InlineMessage
            description="Try another filter or register students for this exam session."
            style={styles.emptyCard}
            title="No students in this filter"
            tone="neutral"
          />
        ) : (
          <View style={styles.grid}>
            {filteredStudents.map((student) => {
              const risk = getRiskPresentation(student.riskLevel, colors);
              const flags = [
                { label: 'G', state: student.indicators.gaze },
                { label: 'F', state: student.indicators.face },
                { label: 'A', state: student.indicators.audio },
                { label: 'M', state: student.indicators.multiFace },
              ] as const;

              return (
                <View key={student.studentId} style={styles.studentCard}>
                  <View style={[styles.scanBox, { borderTopColor: risk.color }]}>
                    <View style={styles.scanGrid} />
                    <View
                      style={[
                        styles.riskBadge,
                        {
                          backgroundColor: `${risk.color}18`,
                          borderColor: `${risk.color}70`,
                        },
                      ]}>
                      <Text style={[styles.riskText, { color: risk.color }]}>{risk.label}</Text>
                    </View>
                    <View style={styles.faceBox}>
                      <Text style={[styles.faceInitials, { color: risk.color }]}>
                        {student.initials}
                      </Text>
                    </View>
                    <Text style={[styles.score, { color: risk.color }]}>{student.score}</Text>
                  </View>

                  <View style={styles.studentBody}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentId}>{student.institutionalId}</Text>
                    <Text style={styles.studentStatus}>{student.status}</Text>
                    <Text numberOfLines={2} style={styles.studentObservation}>
                      {student.latestObservation
                        ? `Latest: ${student.latestObservation}`
                        : 'Latest: No detector observation yet.'}
                    </Text>

                    <View style={styles.flagRow}>
                      {flags.map((flag) => {
                        const chipColor = flag.state === 'alert' ? colors.danger : colors.success;

                        return (
                          <View
                            key={`${student.studentId}-${flag.label}`}
                            style={[
                              styles.flagChip,
                              {
                                backgroundColor: `${chipColor}18`,
                                borderColor: `${chipColor}55`,
                              },
                            ]}>
                            <Text style={[styles.flagText, { color: chipColor }]}>{flag.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.eventsHeader}>
          <Text style={styles.eventsTitle}>SUSPICIOUS CLIPS</Text>
          <Text style={styles.eventsCount}>{suspiciousEvents.length} flags</Text>
        </View>

        {isEventsLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.warning} size="small" />
            <Text style={styles.loadingText}>Loading suspicious recordings...</Text>
          </View>
        ) : null}

        {!isEventsLoading && suspiciousEvents.length === 0 ? (
          <InlineMessage
            description="When students are flagged, the event clip plus about 2 seconds before and after will appear here."
            style={styles.emptyCard}
            title="No suspicious clips yet"
            tone="neutral"
          />
        ) : (
          <View style={styles.eventsList}>
            {suspiciousEvents.map((eventRow) => {
              const isOpen = openEventId === eventRow.id;
              const risk = getRiskPresentation(eventRow.riskLevel, colors);
              const evidenceWindowLabel =
                eventRow.windowStartIso && eventRow.windowEndIso
                  ? `${formatTimestamp(eventRow.windowStartIso)} - ${formatTimestamp(eventRow.windowEndIso)}`
                  : null;

              return (
                <View key={eventRow.id} style={styles.eventCard}>
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
                      <Text style={styles.eventStudent}>
                        {eventRow.studentName} - {eventRow.studentInstitutionalId}
                      </Text>
                    </View>
                    <Text style={styles.eventTime}>{formatTimestamp(eventRow.createdAt)}</Text>
                  </View>

                  <View style={styles.alertDetailsRow}>
                    <View style={styles.alertDetailChip}>
                      <Text style={styles.alertDetailLabel}>SEVERITY</Text>
                      <Text style={styles.alertDetailValue}>
                        {eventRow.severity ? eventRow.severity.toUpperCase() : 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.alertDetailChip}>
                      <Text style={styles.alertDetailLabel}>SIGNAL</Text>
                      <Text numberOfLines={1} style={styles.alertDetailValue}>
                        {eventRow.signalCode ?? 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.eventReason}>{eventRow.reason}</Text>
                  <Text style={styles.eventMeta}>
                    ALERT {formatPreciseSeconds(eventRow.startTimestampSeconds)} -{' '}
                    {formatPreciseSeconds(eventRow.endTimestampSeconds)} | DURATION{' '}
                    {formatAlertDurationSeconds(eventRow.alertDurationSeconds)} | SCORE{' '}
                    {Math.round(eventRow.maxScore)}
                  </Text>
                  {evidenceWindowLabel ? (
                    <Text style={styles.eventMeta}>EVIDENCE WINDOW {evidenceWindowLabel}</Text>
                  ) : null}
                  <Text style={styles.eventMeta}>
                    {eventRow.wasTruncated
                      ? `PARTIAL WINDOW (${eventRow.requestedLeadSeconds}s BEFORE + ${eventRow.requestedTrailSeconds}s AFTER TARGET)`
                      : `FULL ${eventRow.requestedLeadSeconds}s BEFORE + ${eventRow.requestedTrailSeconds}s AFTER`}{' '}
                    | SEGMENTS {eventRow.segments.length}
                  </Text>

                  <Pressable
                    onPress={() => setOpenEventId((current) => (current === eventRow.id ? '' : eventRow.id))}
                    style={styles.clipToggleButton}>
                    <Text style={styles.clipToggleText}>
                      {isOpen ? 'Hide clip evidence' : 'View clip evidence'}
                    </Text>
                  </Pressable>

                  {isOpen ? (
                    <View style={styles.clipList}>
                      {eventRow.segments.length === 0 ? (
                        <Text style={styles.clipWaitingText}>Suspicious clip is still being prepared...</Text>
                      ) : (
                        eventRow.segments.map((segment, index) => (
                          <View key={`${eventRow.id}-${segment.path}-${index}`} style={styles.segmentCard}>
                            <Text style={styles.segmentMeta}>
                              Segment {index + 1}   {formatTimestamp(segment.startedAtIso)}
                            </Text>
                            <Text style={styles.segmentMeta}>
                              Focus {getSegmentRoleLabel(segment.role)}
                            </Text>
                            <Text style={styles.segmentMeta}>
                              Duration {formatSeconds(segment.durationSeconds)}
                            </Text>
                            {(() => {
                              const clipKey = toClipKey(eventRow.id, segment.path);
                              const localClipUri = clipLocalUris[clipKey] ?? null;
                              const clipDownloadError = clipPlaybackErrors[clipKey] ?? '';
                              const isDownloading =
                                Boolean(clipDownloadsInProgress[clipKey]) && !localClipUri;
                              if (localClipUri) {
                                return (
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
                                );
                              }

                              if (isDownloading) {
                                return (
                                  <Text style={styles.clipWaitingText}>
                                    Preparing secure clip playback...
                                  </Text>
                                );
                              }

                              if (clipDownloadError) {
                                return (
                                  <Text style={styles.clipErrorText}>
                                    Unable to play this clip: {clipDownloadError}
                                  </Text>
                                );
                              }

                              return (
                                <Text style={styles.clipWaitingText}>
                                  Clip download is pending...
                                </Text>
                              );
                            })()}
                          </View>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    backButton: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 34,
      justifyContent: 'center',
      width: 34,
      ...shadow.card,
    },
    clipList: {
      gap: 8,
      marginTop: 10,
    },
    clipToggleButton: {
      alignItems: 'center',
      backgroundColor: colors.tealSoft,
      borderColor: colors.tealGlow,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      marginTop: 10,
      paddingVertical: 11,
    },
    clipToggleText: {
      color: colors.teal,
      fontSize: type.body,
      fontWeight: '700',
    },
    clipWaitingText: {
      color: colors.mutedStrong,
      fontSize: type.body,
      marginTop: 6,
    },
    clipErrorText: {
      color: colors.danger,
      fontSize: type.body,
      marginTop: 8,
    },
    content: {
      alignSelf: 'center',
      maxWidth: layout.maxWidth,
      paddingBottom: layout.bottomPadding,
      paddingHorizontal: layout.screenPaddingWide,
      width: '100%',
    },
    courseCode: {
      color: colors.muted,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    courseTitle: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '800',
      marginTop: 6,
    },
    emptyCard: {
      marginTop: 8,
    },
    errorCard: {
      marginBottom: 8,
      marginTop: 10,
    },
    eventCard: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 14,
      ...shadow.card,
    },
    eventHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    eventHeaderLeft: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    alertDetailsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    alertDetailChip: {
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    alertDetailLabel: {
      color: colors.muted,
      fontSize: 10,
      letterSpacing: 0.9,
    },
    alertDetailValue: {
      color: colors.text,
      fontSize: type.tiny,
      fontWeight: '700',
      marginTop: 4,
      textTransform: 'uppercase',
    },
    eventMeta: {
      color: colors.muted,
      fontSize: type.tiny,
      letterSpacing: 0.4,
      marginTop: 5,
      textTransform: 'uppercase',
    },
    eventReason: {
      color: colors.text,
      fontSize: type.bodyLarge,
      marginTop: 10,
    },
    eventStudent: {
      color: colors.text,
      fontSize: type.body,
      fontWeight: '700',
    },
    eventTime: {
      color: colors.muted,
      fontSize: type.tiny,
    },
    eventsCount: {
      color: colors.warning,
      fontSize: type.body,
      fontWeight: '700',
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
    eventsTitle: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    faceBox: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 30,
      justifyContent: 'center',
      left: '38%',
      position: 'absolute',
      top: '38%',
      width: 30,
    },
    faceInitials: {
      fontSize: 11,
      fontWeight: '800',
    },
    filterItem: {
      alignItems: 'center',
      borderRadius: radius.pill,
      flex: 1,
      paddingVertical: 9,
    },
    filterItemActive: {
      backgroundColor: colors.tealSoft,
    },
    filterRow: {
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 4,
      marginBottom: 16,
      marginTop: 6,
      padding: 4,
    },
    filterText: {
      color: colors.muted,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    filterTextActive: {
      color: colors.teal,
      fontWeight: '800',
    },
    flagChip: {
      alignItems: 'center',
      borderWidth: 1.5,
      borderRadius: radius.pill,
      height: 20,
      justifyContent: 'center',
      minWidth: 20,
      paddingHorizontal: 5,
    },
    flagRow: {
      flexDirection: 'row',
      gap: 4,
      marginTop: 12,
    },
    flagText: {
      fontSize: 9,
      fontWeight: '700',
    },
    grid: {
      columnGap: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 10,
    },
    headerCard: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginBottom: 12,
      padding: 12,
      ...shadow.card,
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    headerText: {
      flex: 1,
      marginLeft: 6,
    },
    levelBadge: {
      borderRadius: radius.pill,
      borderWidth: 1.5,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    levelText: {
      fontSize: type.tiny,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    liveDot: {
      borderRadius: 99,
      height: 6,
      width: 6,
    },
    liveText: {
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    liveWrap: {
      alignItems: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    loadingCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      ...shadow.card,
    },
    loadingText: {
      color: colors.mutedStrong,
      fontSize: type.body,
    },
    riskBadge: {
      borderRadius: radius.pill,
      borderWidth: 1.5,
      paddingHorizontal: 8,
      paddingVertical: 4,
      position: 'absolute',
      right: 8,
      top: 8,
    },
    riskText: {
      fontSize: type.tiny,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1,
    },
    scanBox: {
      backgroundColor: colors.panelSoft,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      borderTopWidth: 3,
      height: 120,
      overflow: 'hidden',
      position: 'relative',
    },
    scanGrid: {
      borderColor: colors.borderSoft,
      borderRadius: radius.sm,
      borderWidth: 1,
      bottom: 10,
      left: 10,
      position: 'absolute',
      right: 10,
      top: 10,
    },
    score: {
      bottom: 10,
      fontSize: type.title,
      fontWeight: '800',
      position: 'absolute',
      right: 10,
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
      fontSize: type.tiny,
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
    statTile: {
      minHeight: 72,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    studentBody: {
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    studentCard: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      overflow: 'hidden',
      width: '48.5%',
      ...shadow.card,
    },
    studentId: {
      color: colors.muted,
      fontSize: 10,
      marginTop: 4,
    },
    studentName: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '700',
    },
    studentStatus: {
      color: colors.mutedStrong,
      fontSize: type.tiny,
      letterSpacing: 0.4,
      marginTop: 6,
      textTransform: 'uppercase',
    },
    studentObservation: {
      color: colors.mutedStrong,
      fontSize: type.tiny,
      lineHeight: 16,
      marginTop: 4,
      minHeight: 32,
    },
  });
}
