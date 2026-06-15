import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
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
  fetchInvigilatorDashboardData,
  type InvigilatorDashboardData,
  type SessionRiskLevel,
} from '@/lib/invigilator-sessions';

function riskLevelPresentation(riskLevel: SessionRiskLevel) {
  if (riskLevel === 'high') {
    return { color: '#ef476f', label: 'HIGH' };
  }

  if (riskLevel === 'medium') {
    return { color: '#f1bf21', label: 'MED' };
  }

  return { color: '#28ef8d', label: 'LOW' };
}

function formatSessionStart(isoDate: string) {
  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unknown start time';
  }

  return parsedDate.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
}

export default function InvigilatorDashboardScreen() {
  const [dashboardData, setDashboardData] = useState<InvigilatorDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await fetchInvigilatorDashboardData();
      setDashboardData(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load dashboard right now.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
      return undefined;
    }, [loadDashboard])
  );

  const metrics = useMemo(
    () => [
      {
        label: 'SESSIONS',
        value: String(dashboardData?.stats.totalSessions ?? 0),
        valueColor: palette.teal,
      },
      {
        label: 'ONLINE',
        value: String(dashboardData?.stats.online ?? 0),
        valueColor: palette.success,
      },
      {
        label: 'FLAGGED',
        value: String(dashboardData?.stats.flagged ?? 0),
        valueColor: palette.warning,
      },
      {
        label: 'DONE',
        value: String(dashboardData?.stats.done ?? 0),
        valueColor: '#8aa0c4',
      },
    ],
    [dashboardData]
  );

  const sessions = dashboardData?.sessions ?? [];
  const staffName = dashboardData?.staffName ?? 'Invigilator';
  const staffMeta = dashboardData?.staffInstitutionalId
    ? `${dashboardData.staffInstitutionalId.toUpperCase()} - L2`
    : 'INVIGILATOR - L2';
  const activeSessionsCount = dashboardData?.stats.active ?? 0;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerMetaRow}>
          <Text style={styles.staffMeta}>{staffMeta}</Text>
          <View style={styles.headerActions}>
            <View style={styles.bellWrap}>
              <Ionicons color={palette.mutedStrong} name="notifications-outline" size={18} />
              <View style={styles.alertCount}>
                <Text style={styles.alertCountText}>{dashboardData?.stats.flagged ?? 0}</Text>
              </View>
            </View>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>
                {staffName
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.staffName}>{staffName}</Text>

        <View style={styles.metricRow}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: metric.valueColor }]}>{metric.value}</Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
            </View>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={palette.teal} size="small" />
            <Text style={styles.loadingText}>Loading sessions...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable onPress={() => void loadDashboard()} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>LIVE SESSIONS</Text>
          <View style={styles.sectionRight}>
            <View style={styles.sectionState}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionAccent}>{activeSessionsCount} active</Text>
            </View>
            <Pressable
              onPress={() => router.push('/(invigilator-tabs)/create')}
              style={styles.createButton}>
              <Feather color={palette.warning} name="plus" size={13} />
              <Text style={styles.createButtonText}>Create</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.cardList}>
          {sessions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No active sessions yet</Text>
              <Text style={styles.emptyCopy}>
                Create your first exam session to populate this live dashboard.
              </Text>
            </View>
          ) : (
            sessions.map((session) => {
              const riskPresentation = riskLevelPresentation(session.riskLevel);

              return (
                <View
                  key={session.examId}
                  style={[styles.sessionCard, { borderLeftColor: riskPresentation.color }]}>
                  <View style={styles.sessionHeader}>
                    <View style={styles.sessionTitleBlock}>
                      <View style={styles.sessionMetaRow}>
                        <Text style={styles.sessionCode}>{session.code}</Text>
                        <View
                          style={[
                            styles.levelBadge,
                            {
                              backgroundColor: `${riskPresentation.color}20`,
                              borderColor: `${riskPresentation.color}55`,
                            },
                          ]}>
                          <Text style={[styles.levelText, { color: riskPresentation.color }]}>
                            {riskPresentation.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.sessionTitle}>{session.title}</Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/(invigilator-tabs)/monitor',
                          params: { examId: session.examId },
                        })
                      }
                      style={styles.monitorButton}>
                      <Text style={styles.monitorText}>Monitor</Text>
                      <Feather color={palette.teal} name="arrow-right" size={14} />
                    </Pressable>
                  </View>

                  <Text style={styles.sessionFoot}>
                    <Text style={styles.sessionStudents}>
                      {session.registeredStudents} registered
                    </Text>
                    <Text style={styles.sessionFlags}>   {session.flaggedSessions} flagged</Text>
                  </Text>
                  <Text style={styles.sessionTimeMeta}>
                    {formatSessionStart(session.scheduledStart)}   {session.monitoringMode.toUpperCase()}   
                    {session.status.toUpperCase()}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <Text style={[styles.sectionLabel, styles.alertsHeader]}>RECENT ALERTS</Text>

        <View style={styles.cardList}>
          <View style={styles.alertCard}>
            <View style={styles.alertLead}>
              <View
                style={[
                  styles.alertMarker,
                  {
                    backgroundColor:
                      (dashboardData?.stats.flagged ?? 0) > 0 ? palette.warning : palette.success,
                  },
                ]}
              />
              <View>
                <Text style={styles.alertName}>Alert stream</Text>
                <Text style={styles.alertText}>
                  {(dashboardData?.stats.flagged ?? 0) > 0
                    ? 'Flagged sessions are detected in live monitoring.'
                    : 'No flagged activity yet. New alerts will appear here.'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  alertCard: {
    alignItems: 'flex-start',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  alertCount: {
    alignItems: 'center',
    backgroundColor: palette.danger,
    borderRadius: 99,
    height: 16,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
    top: -6,
    width: 16,
  },
  alertCountText: {
    color: palette.text,
    fontSize: 9,
    fontWeight: '800',
  },
  alertLead: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  alertMarker: {
    borderRadius: 99,
    height: 7,
    marginTop: 6,
    width: 7,
  },
  alertName: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  alertText: {
    color: palette.mutedStrong,
    fontSize: 13,
    marginTop: 6,
  },
  alertsHeader: {
    marginBottom: 14,
    marginTop: 28,
  },
  avatarBox: {
    alignItems: 'center',
    borderColor: palette.warning,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  avatarText: {
    color: palette.warning,
    fontSize: 12,
    fontWeight: '800',
  },
  bellWrap: {
    padding: 2,
    position: 'relative',
  },
  cardList: {
    gap: 10,
  },
  content: {
    alignSelf: 'center',
    maxWidth: layout.maxWidth,
    paddingBottom: layout.bottomPadding,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  createButton: {
    alignItems: 'center',
    borderColor: '#6c5211',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  createButtonText: {
    color: palette.warning,
    fontSize: type.body,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
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
    marginBottom: 14,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  errorText: {
    color: '#ff9ea8',
    fontSize: type.body,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  headerMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  loadingCard: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  loadingText: {
    color: palette.mutedStrong,
    fontSize: type.body,
  },
  metricCard: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 68,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  metricLabel: {
    color: palette.mutedStrong,
    fontSize: type.tiny,
    letterSpacing: 1.2,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 22,
    marginTop: 18,
  },
  metricValue: {
    fontSize: type.display,
    fontWeight: '800',
  },
  monitorButton: {
    alignItems: 'center',
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  monitorText: {
    color: palette.teal,
    fontSize: type.body,
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
  sectionAccent: {
    color: '#ff6a6a',
    fontSize: type.body,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionDot: {
    backgroundColor: palette.danger,
    borderRadius: 99,
    height: 6,
    width: 6,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionLabel: {
    color: palette.mutedStrong,
    fontSize: type.label,
    letterSpacing: 2.1,
  },
  sectionRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  sectionState: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sessionCard: {
    backgroundColor: palette.panel,
    borderBottomWidth: 1,
    borderColor: palette.border,
    borderLeftWidth: 2,
    borderRightWidth: 1,
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sessionCode: {
    color: palette.muted,
    fontSize: 11,
  },
  sessionFlags: {
    color: palette.warning,
    fontSize: 13,
    fontWeight: '700',
  },
  sessionFoot: {
    color: palette.mutedStrong,
    fontSize: 13,
    marginTop: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  sessionMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sessionStudents: {
    color: palette.mutedStrong,
  },
  sessionTimeMeta: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  sessionTitle: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: '700',
    marginTop: 10,
  },
  sessionTitleBlock: {
    flex: 1,
  },
  staffMeta: {
    color: palette.warning,
    fontSize: 11,
    letterSpacing: 1.1,
  },
  staffName: {
    color: palette.text,
    fontSize: type.display,
    fontWeight: '800',
    marginTop: 6,
  },
});
