import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
  type InvigilatorMonitorData,
  type InvigilatorMonitorStudent,
  type MonitorRiskLevel,
} from '@/lib/invigilator-sessions';

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

export default function InvigilatorMonitorScreen() {
  const params = useLocalSearchParams<{ examId?: string | string[] }>();
  const examId = useMemo(
    () => (Array.isArray(params.examId) ? params.examId[0] : params.examId) ?? '',
    [params.examId]
  );
  const [monitorData, setMonitorData] = useState<InvigilatorMonitorData | null>(null);
  const [activeFilter, setActiveFilter] = useState<MonitorFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadMonitorData = useCallback(async () => {
    if (!examId) {
      setMonitorData(null);
      setErrorMessage('Open a session from the dashboard to monitor students.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await fetchInvigilatorMonitorData(examId);
      setMonitorData(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load monitor data.');
    } finally {
      setIsLoading(false);
    }
  }, [examId]);

  useFocusEffect(
    useCallback(() => {
      void loadMonitorData();
      return undefined;
    }, [loadMonitorData])
  );

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
            <Pressable onPress={() => void loadMonitorData()} style={styles.retryButton}>
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
