import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, InlineMessage, SurfaceCard } from '@/components/product-ui';
import { layout, radius, shadow, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
import { useAppTheme } from '@/hooks/use-app-theme';
import { fetchStudentProfileData, type StudentProfileData } from '@/lib/student-profile';

const permissionItems = [
  { allowed: true, label: 'View registered exam sessions' },
  { allowed: true, label: 'Join live student exam sessions' },
  { allowed: true, label: 'View submitted exam results' },
  { allowed: false, label: 'Create or monitor exam sessions' },
];

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
    { icon: 'account-check-outline' as const, label: 'Role', value: profileData?.role.toUpperCase() ?? 'STUDENT' },
    { icon: 'clipboard-text-outline' as const, label: 'Exams', value: String(profileData?.stats.examsTaken ?? 0) },
    { icon: 'shield-check-outline' as const, label: 'Integrity', value: String(profileData?.stats.integrity ?? 100) },
  ];

  return (
    <AppScreen accent="teal" contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(tabs)/profile')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>ACCESS ROLE</Text>
          <Text style={styles.headerTitle}>Student permissions</Text>
        </View>
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

      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons color={colors.teal} name="shield-account-outline" size={24} />
        </View>
        <View style={styles.heroText}>
          <Text numberOfLines={1} style={styles.name}>{profileData?.studentName ?? 'Student'}</Text>
          <Text style={styles.meta}>
            {profileData?.studentId ? profileData.studentId.toUpperCase() : 'STUDENT ID NOT SET'}
          </Text>
          <Text numberOfLines={1} style={styles.metaSmall}>
            {profileData?.departmentName ?? 'Department not set'}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statTile}>
            <MaterialCommunityIcons color={colors.teal} name={stat.icon} size={17} />
            <Text numberOfLines={1} style={styles.statValue}>{stat.value}</Text>
            <Text numberOfLines={1} style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <SurfaceCard style={styles.permissionsCard} tone="muted">
        <Text style={styles.sectionTitle}>Permissions</Text>
        <View style={styles.permissionList}>
          {permissionItems.map((item) => (
            <View key={item.label} style={styles.permissionRow}>
              <Feather
                color={item.allowed ? colors.success : colors.danger}
                name={item.allowed ? 'check-circle' : 'x-circle'}
                size={18}
              />
              <Text style={styles.permissionText}>{item.label}</Text>
            </View>
          ))}
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
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    content: {
      paddingBottom: layout.bottomPadding,
    },
    eyebrow: {
      color: colors.teal,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    headerText: {
      flex: 1,
      gap: 3,
    },
    headerTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    heroCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 13,
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 15,
      ...shadow.raised,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.tealSoft,
      borderColor: colors.tealGlow,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    heroText: {
      flex: 1,
      minWidth: 0,
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
      marginTop: 5,
    },
    metaSmall: {
      color: colors.muted,
      fontSize: type.tiny,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginTop: 5,
      textTransform: 'uppercase',
    },
    name: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '900',
    },
    permissionList: {
      gap: 12,
      marginTop: 14,
    },
    permissionRow: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 11,
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    permissionText: {
      color: colors.mutedStrong,
      flex: 1,
      fontSize: type.bodyLarge,
      fontWeight: '700',
      lineHeight: 21,
    },
    permissionsCard: {
      marginTop: 18,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    statLabel: {
      color: colors.mutedStrong,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.5,
      marginTop: 4,
      textTransform: 'uppercase',
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    statTile: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      minHeight: 76,
      minWidth: 0,
      paddingHorizontal: 10,
      paddingVertical: 11,
      ...shadow.card,
    },
    statValue: {
      color: colors.teal,
      fontSize: 18,
      fontWeight: '900',
      marginTop: 7,
    },
  });
}
