import { Feather } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, palette, type } from '@/constants/design';
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

function getRiskPresentation(riskLevel: MonitorRiskLevel) {
  if (riskLevel === 'critical') {
    return { color: '#f94144', label: 'CRIT' };
  }

  if (riskLevel === 'high') {
    return { color: '#ef476f', label: 'HIGH' };
  }

  if (riskLevel === 'medium') {
    return { color: palette.warning, label: 'MED' };
  }

  return { color: palette.success, label: 'LOW' };
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

function getExamStatusColor(status: InvigilatorMonitorData['examStatus']) {
  if (status === 'live') {
    return palette.danger;
  }

  if (status === 'scheduled') {
    return palette.warning;
  }

  if (status === 'completed') {
    return palette.success;
  }

  return palette.muted;
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

export default function InvigilatorMonitorScreen() {
  const params = useLocalSearchParams<{ examId?: string | string[] }>();
  const examId = useMemo(
    () => (Array.isArray(params.examId) ? params.examId[0] : params.examId) ?? '',
    [params.examId]
  );
  const [monitorData, setMonitorData] = useState<InvigilatorMonitorData | null>(null);
  const [activeFilter, setActiveFilter] = useState<MonitorFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [suspiciousEvents, setSuspiciousEvents] = useState<InvigilatorSuspiciousEvent[]>([]);
  const [openEventId, setOpenEventId] = useState('');
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const statusColor = monitorData ? getExamStatusColor(monitorData.examStatus) : palette.muted;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.navigate('/(invigilator-tabs)')}
            style={styles.backButton}>
            <Feather color={palette.mutedStrong} name="chevron-left" size={18} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.courseCode}>{monitorData?.courseCode ?? 'COURSE'}</Text>
            <Text style={styles.courseTitle}>{monitorData?.title ?? 'Exam Session'}</Text>
          </View>
          <View style={styles.liveWrap}>
            <View style={[styles.liveDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.liveText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{monitorData?.stats.total ?? 0}</Text>
            <Text style={styles.statLabel}>TOTAL</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: palette.success }]}>
              {monitorData?.stats.active ?? 0}
            </Text>
            <Text style={styles.statLabel}>ACTIVE</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: palette.warning }]}>
              {monitorData?.stats.flagged ?? 0}
            </Text>
            <Text style={styles.statLabel}>FLAGGED</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#7a95c3' }]}>{monitorData?.stats.done ?? 0}</Text>
            <Text style={styles.statLabel}>DONE</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={palette.teal} size="small" />
            <Text style={styles.loadingText}>Loading monitor feed...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable onPress={() => void loadAll(true)} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.filterRow}>
          {filters.map((filter) => {
            const active = activeFilter === filter;

            return (
              <Pressable
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={styles.filterItem}>
                <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>
                  {getFilterLabel(filter)}
                </Text>
                <View
                  style={[styles.filterUnderline, active ? styles.filterUnderlineActive : null]}
                />
              </Pressable>
            );
          })}
        </View>

        {filteredStudents.length === 0 && !isLoading && !errorMessage ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No students in this filter</Text>
            <Text style={styles.emptyCopy}>
              Try another filter or register students for this exam session.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredStudents.map((student) => {
              const risk = getRiskPresentation(student.riskLevel);
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

                    <View style={styles.flagRow}>
                      {flags.map((flag) => {
                        const chipColor = flag.state === 'alert' ? '#ef476f' : palette.success;

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
            <ActivityIndicator color={palette.warning} size="small" />
            <Text style={styles.loadingText}>Loading suspicious recordings...</Text>
          </View>
        ) : null}

        {!isEventsLoading && suspiciousEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No suspicious clips yet</Text>
            <Text style={styles.emptyCopy}>
              When students are flagged, 5 seconds before and after each event will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {suspiciousEvents.map((eventRow) => {
              const isOpen = openEventId === eventRow.id;
              const risk = getRiskPresentation(eventRow.riskLevel);
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

                  <Text style={styles.eventReason}>{eventRow.reason}</Text>
                  <Text style={styles.eventMeta}>
                    EVENT WINDOW {formatSeconds(eventRow.startTimestampSeconds)} -{' '}
                    {formatSeconds(eventRow.endTimestampSeconds)}   SCORE {eventRow.maxScore}
                  </Text>
                  {evidenceWindowLabel ? (
                    <Text style={styles.eventMeta}>EVIDENCE WINDOW {evidenceWindowLabel}</Text>
                  ) : null}
                  <Text style={styles.eventMeta}>
                    {eventRow.wasTruncated ? 'PARTIAL WINDOW' : 'FULL 5S BEFORE + 5S AFTER'}   SEGMENTS{' '}
                    {eventRow.segments.length}
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
                              Duration {Math.round(segment.durationSeconds)}s
                            </Text>
                            {segment.videoUrl ? (
                              <Video
                                isLooping
                                resizeMode={ResizeMode.COVER}
                                source={{ uri: segment.videoUrl }}
                                style={styles.segmentVideo}
                                useNativeControls
                              />
                            ) : (
                              <Text style={styles.clipWaitingText}>Signed URL unavailable for this segment.</Text>
                            )}
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

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  clipList: {
    gap: 8,
    marginTop: 10,
  },
  clipToggleButton: {
    alignItems: 'center',
    borderColor: '#2f4d75',
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 10,
  },
  clipToggleText: {
    color: '#9ab5dd',
    fontSize: type.body,
    fontWeight: '700',
  },
  clipWaitingText: {
    color: '#93abcf',
    fontSize: type.body,
    marginTop: 6,
  },
  content: {
    alignSelf: 'center',
    maxWidth: layout.maxWidth,
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  courseCode: {
    color: '#6f8fbc',
    fontSize: type.label,
    letterSpacing: 2,
  },
  courseTitle: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: '800',
    marginTop: 6,
  },
  emptyCard: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  emptyCopy: {
    color: palette.mutedStrong,
    fontSize: type.body,
    marginTop: 8,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: type.bodyLarge,
    fontWeight: '700',
  },
  errorCard: {
    alignItems: 'flex-start',
    backgroundColor: '#2f1116',
    borderColor: '#8f2d37',
    borderWidth: 1,
    marginBottom: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  errorText: {
    color: '#ff9ea8',
    fontSize: type.body,
  },
  eventCard: {
    backgroundColor: '#0b172b',
    borderColor: '#234069',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
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
  eventMeta: {
    color: '#85a0c7',
    fontSize: type.tiny,
    letterSpacing: 1,
    marginTop: 5,
    textTransform: 'uppercase',
  },
  eventReason: {
    color: palette.text,
    fontSize: type.bodyLarge,
    marginTop: 10,
  },
  eventStudent: {
    color: '#d7e5ff',
    fontSize: type.body,
    fontWeight: '700',
  },
  eventTime: {
    color: '#8fa5c6',
    fontSize: type.tiny,
  },
  eventsCount: {
    color: palette.warning,
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
    color: palette.mutedStrong,
    fontSize: type.label,
    letterSpacing: 2.2,
  },
  faceBox: {
    alignItems: 'center',
    borderColor: '#205477',
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
    flex: 1,
  },
  filterRow: {
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    marginBottom: 16,
    marginTop: 6,
  },
  filterText: {
    color: '#6f8fbc',
    fontSize: type.label,
    letterSpacing: 1.8,
    paddingBottom: 12,
  },
  filterTextActive: {
    color: palette.teal,
    fontWeight: '700',
  },
  filterUnderline: {
    backgroundColor: 'transparent',
    height: 2,
    width: '100%',
  },
  filterUnderlineActive: {
    backgroundColor: palette.warning,
  },
  flagChip: {
    alignItems: 'center',
    borderWidth: 1,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
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
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  levelText: {
    fontSize: type.tiny,
    fontWeight: '700',
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
    letterSpacing: 1.1,
  },
  liveWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  loadingText: {
    color: palette.mutedStrong,
    fontSize: type.body,
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
  riskBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  riskText: {
    fontSize: type.tiny,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  scanBox: {
    backgroundColor: '#07121f',
    borderTopWidth: 2,
    height: 120,
    overflow: 'hidden',
    position: 'relative',
  },
  scanGrid: {
    borderColor: '#0d3552',
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
    backgroundColor: '#0a1323',
    borderColor: '#20324f',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  segmentMeta: {
    color: '#8ea7ca',
    fontSize: type.tiny,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  segmentVideo: {
    backgroundColor: '#02050d',
    height: 176,
    marginTop: 6,
    width: '100%',
  },
  statCard: {
    alignItems: 'center',
    borderRightColor: palette.border,
    borderRightWidth: 1,
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 58,
  },
  statLabel: {
    color: '#6f8fbc',
    fontSize: type.tiny,
    letterSpacing: 1.2,
  },
  statValue: {
    color: palette.text,
    fontSize: type.display,
    fontWeight: '800',
  },
  statsRow: {
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    borderTopColor: palette.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    marginBottom: 8,
    paddingVertical: 10,
  },
  studentBody: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  studentCard: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    width: '48.5%',
  },
  studentId: {
    color: '#6f8fbc',
    fontSize: 10,
    marginTop: 4,
  },
  studentName: {
    color: palette.text,
    fontSize: type.bodyLarge,
    fontWeight: '700',
  },
  studentStatus: {
    color: palette.mutedStrong,
    fontSize: type.tiny,
    letterSpacing: 1.1,
    marginTop: 6,
    textTransform: 'uppercase',
  },
});
