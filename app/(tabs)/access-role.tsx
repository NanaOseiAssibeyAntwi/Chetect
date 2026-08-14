import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, InlineMessage, MetricTile, SurfaceCard } from '@/components/product-ui';
import { layout, radius, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
import { useAppTheme } from '@/hooks/use-app-theme';
import { fetchStudentProfileData, type StudentProfileData } from '@/lib/student-profile';

export default function AccessRoleScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    data: profileData,
    errorMessage,
    isLoading,
    refresh: refreshProfile,
  } = useCachedResource<StudentProfileData | null>({
    initialData: null,
    key: 'student.profile',
    loader: fetchStudentProfileData,
    maxAgeMs: 60_000,
  });

  useFocusEffect(
    useCallback(() => {
      void refreshProfile({ showLoader: profileData === null });
      return undefined;
    }, [profileData, refreshProfile])
  );

  const stats = [
    { label: 'ROLE', value: profileData?.role.toUpperCase() ?? 'STUDENT' },
    { label: 'EXAMS', value: String(profileData?.stats.examsTaken ?? 0) },
    { label: 'INTEGRITY', value: String(profileData?.stats.integrity ?? 100) },
  ];

  return (
    <AppScreen contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(tabs)/profile')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <Text style={styles.eyebrow}>ACCESS ROLE</Text>
      </View>

      {isLoading ? (
        <SurfaceCard style={styles.loadingCard} tone="muted">
          <ActivityIndicator color={colors.teal} size="small" />
          <Text style={styles.loadingText}>Loading role...</Text>
        </SurfaceCard>
      ) : null}

      {errorMessage ? (
        <InlineMessage
          action={
            <ActionButton
              compact
              fullWidth={false}
              label="Retry"
              onPress={() => void refreshProfile({ force: true })}
              tone="danger"
            />
          }
          description={errorMessage}
          style={styles.message}
          tone="danger"
        />
      ) : null}

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons color={colors.teal} name="shield-account-outline" size={26} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.name}>{profileData?.studentName ?? 'Student'}</Text>
          <Text style={styles.meta}>
            {profileData?.studentId ? profileData.studentId.toUpperCase() : 'STUDENT ID NOT SET'}
          </Text>
          <Text style={styles.metaSmall}>
            {profileData?.departmentName ?? 'Department not set'}
          </Text>
        </View>
      </SurfaceCard>

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <MetricTile
            accentColor={colors.teal}
            key={stat.label}
            label={stat.label}
            style={styles.statTile}
            value={stat.value}
          />
        ))}
      </View>

      <SurfaceCard style={styles.permissionsCard} tone="muted">
        <Text style={styles.sectionTitle}>Permissions</Text>
        <View style={styles.permissionRow}>
          <Feather color={colors.success} name="check-circle" size={17} />
          <Text style={styles.permissionText}>View registered exam sessions</Text>
        </View>
        <View style={styles.permissionRow}>
          <Feather color={colors.success} name="check-circle" size={17} />
          <Text style={styles.permissionText}>Join live student exam sessions</Text>
        </View>
        <View style={styles.permissionRow}>
          <Feather color={colors.success} name="check-circle" size={17} />
          <Text style={styles.permissionText}>View submitted exam results</Text>
        </View>
        <View style={styles.permissionRow}>
          <Feather color={colors.danger} name="x-circle" size={17} />
          <Text style={styles.permissionText}>Create or monitor exam sessions</Text>
        </View>
      </SurfaceCard>
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
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    content: {
      paddingBottom: layout.bottomPadding,
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
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      marginTop: 18,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.tealSoft,
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
      marginTop: 4,
    },
    metaSmall: {
      color: colors.muted,
      fontSize: type.tiny,
      marginTop: 4,
      textTransform: 'uppercase',
    },
    name: {
      color: colors.text,
      fontSize: type.title + 2,
      fontWeight: '800',
    },
    permissionRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    permissionText: {
      color: colors.mutedStrong,
      flex: 1,
      fontSize: type.bodyLarge,
      lineHeight: 21,
    },
    permissionsCard: {
      marginTop: 18,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '800',
    },
    statTile: {
      minHeight: 70,
      paddingHorizontal: 10,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
    },
  });
}
