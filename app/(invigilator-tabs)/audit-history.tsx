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
  fetchInvigilatorAuditHistory,
  type InvigilatorAuditHistoryItem,
} from '@/lib/invigilator-sessions';

const EMPTY_HISTORY: InvigilatorAuditHistoryItem[] = [];

function formatScheduledStart(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown schedule';
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusTone(status: InvigilatorAuditHistoryItem['status']) {
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

export default function InvigilatorAuditHistoryScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    data: history,
    errorMessage,
    isLoading,
    refresh: refreshHistory,
  } = useCachedResource<InvigilatorAuditHistoryItem[]>({
    initialData: EMPTY_HISTORY,
    key: 'invigilator.audit-history',
    loader: fetchInvigilatorAuditHistory,
    maxAgeMs: 45_000,
  });

  useFocusEffect(
    useCallback(() => {
      void refreshHistory();
      return undefined;
    }, [refreshHistory])
  );

  return (
    <AppScreen accent="warning" contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(invigilator-tabs)/profile')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <Text style={styles.eyebrow}>AUDIT HISTORY</Text>
      </View>

      <SurfaceCard style={styles.heroCard}>
        <Text style={styles.title}>Oversight Sessions</Text>
        <Text style={styles.meta}>{history.length} assigned or created sessions</Text>
      </SurfaceCard>

      {isLoading ? (
        <SurfaceCard style={styles.loadingCard} tone="muted">
          <ActivityIndicator color={colors.warning} size="small" />
          <Text style={styles.loadingText}>Loading audit history...</Text>
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
          description="Created and assigned exam sessions will appear here."
          style={styles.message}
          title="No audit records"
          tone="neutral"
        />
      ) : null}

      <View style={styles.list}>
        {history.map((item) => (
          <SurfaceCard key={item.examId}>
            <View style={styles.auditHeader}>
              <View style={styles.auditTitleBlock}>
                <Text style={styles.courseCode}>{item.courseCode}</Text>
                <Text style={styles.auditTitle}>{item.title}</Text>
              </View>
              <AccentBadge label={item.status.toUpperCase()} tone={getStatusTone(item.status)} />
            </View>
            <Text style={styles.scheduleText}>{formatScheduledStart(item.scheduledStart)}</Text>
            <View style={styles.auditStats}>
              <Text style={styles.auditMeta}>{item.registeredStudents} registered</Text>
              <Text style={styles.auditMeta}>{item.flaggedSessions} flagged</Text>
              <Text style={styles.integrityText}>TRUST {item.integrityScore}</Text>
            </View>
            <Text style={styles.modeText}>{item.monitoringMode.toUpperCase()} MONITORING</Text>
          </SurfaceCard>
        ))}
      </View>
    </AppScreen>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    auditHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
    },
    auditMeta: {
      color: colors.mutedStrong,
      fontSize: type.body,
      fontWeight: '700',
    },
    auditStats: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 14,
    },
    auditTitle: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '800',
      marginTop: 6,
    },
    auditTitleBlock: {
      flex: 1,
    },
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
    eyebrow: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    heroCard: {
      marginTop: 18,
    },
    integrityText: {
      color: colors.success,
      fontSize: type.body,
      fontWeight: '800',
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
    modeText: {
      color: colors.muted,
      fontSize: type.tiny,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginTop: 12,
    },
    scheduleText: {
      color: colors.muted,
      fontSize: type.body,
      marginTop: 10,
    },
    title: {
      color: colors.text,
      fontSize: type.title + 2,
      fontWeight: '800',
    },
  });
}
