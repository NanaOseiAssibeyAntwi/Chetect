import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, InlineMessage, MetricTile, SurfaceCard } from '@/components/product-ui';
import { layout, radius, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';
import { fetchStudentProfileData, type StudentProfileData } from '@/lib/student-profile';
import { useSession } from '@/providers/session-provider';

type ProfileIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type ProfileActionHref =
  | '/(tabs)/access-role'
  | '/(tabs)/change-password'
  | '/(tabs)/help-support'
  | '/(tabs)/notifications'
  | '/(tabs)/session-history';
type ProfileActionItem = {
  href: ProfileActionHref;
  icon: ProfileIconName;
  label: string;
  value: string;
};

function toInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || 'ST';
}

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { signOut } = useSession();
  const [profileData, setProfileData] = useState<StudentProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await fetchStudentProfileData();
      setProfileData(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load profile data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
      return undefined;
    }, [loadProfile])
  );

  const stats = useMemo(
    () => [
      { label: 'EXAMS', value: String(profileData?.stats.examsTaken ?? 0) },
      { label: 'AVG SCORE', value: `${profileData?.stats.averageScore ?? 0}%` },
      { label: 'INTEGRITY', value: String(profileData?.stats.integrity ?? 100) },
    ],
    [profileData]
  );

  const accountItems = useMemo(
    () =>
      [
        {
          href: '/(tabs)/notifications',
          icon: 'bell-outline',
          label: 'Notifications',
          value: `${profileData?.unreadNotifications ?? 0} unread alerts`,
        },
        {
          href: '/(tabs)/change-password',
          icon: 'lock-outline',
          label: 'Change Password',
          value: 'Update your sign-in password',
        },
        {
          href: '/(tabs)/access-role',
          icon: 'shield-account-outline',
          label: 'Access Role',
          value: profileData?.role ? profileData.role.toUpperCase() : 'STUDENT',
        },
      ] satisfies ProfileActionItem[],
    [profileData]
  );

  const privacyItems = useMemo(
    () =>
      [
        {
          href: '/(tabs)/session-history',
          icon: 'file-document-outline',
          label: 'Session History',
          value: `${profileData?.stats.examsTaken ?? 0} completed sessions`,
        },
        {
          href: '/(tabs)/help-support',
          icon: 'help-circle-outline',
          label: 'Help & Support',
          value: 'Contact academic IT',
        },
      ] satisfies ProfileActionItem[],
    [profileData]
  );

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await signOut();
      router.replace('/sign-in');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <AppScreen accent="teal" contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(tabs)')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <Text style={styles.eyebrow}>PROFILE</Text>
      </View>

      {isLoading ? (
        <SurfaceCard style={styles.loadingCard} tone="muted">
          <ActivityIndicator color={colors.teal} size="small" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </SurfaceCard>
      ) : null}

      {errorMessage ? (
        <InlineMessage
          action={
            <ActionButton
              compact
              fullWidth={false}
              label="Retry"
              onPress={() => void loadProfile()}
              tone="danger"
            />
          }
          description={errorMessage}
          style={styles.errorMessage}
          tone="danger"
        />
      ) : null}

      <SurfaceCard style={styles.heroGradient}>
        <View style={styles.avatarRing}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{toInitials(profileData?.studentName ?? 'Student')}</Text>
          </View>
        </View>
        <Text style={styles.name}>{profileData?.studentName ?? 'Student'}</Text>
        <Text style={styles.meta}>
          {profileData?.studentId ? profileData.studentId.toUpperCase() : 'STUDENT ID NOT SET'}
        </Text>
        <View style={styles.deptPill}>
          <Text style={styles.deptPillText}>{profileData?.departmentName ?? 'Department not set'}</Text>
        </View>
      </SurfaceCard>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>INTEGRITY RECORD</Text>
        <View style={styles.statsRow}>
          {stats.map((item) => (
            <MetricTile
              accentColor={colors.teal}
              key={item.label}
              label={item.label}
              style={styles.statCard}
              value={item.value}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <SurfaceCard style={styles.group} tone="muted">
          {accountItems.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => router.push(item.href)}
              style={({ pressed }) => [
                styles.infoCard,
                index === accountItems.length - 1 ? styles.infoCardLast : null,
                pressed ? styles.infoCardPressed : null,
              ]}>
              <View style={styles.itemRow}>
                <MaterialCommunityIcons color={colors.mutedStrong} name={item.icon} size={20} />
                <View style={styles.itemText}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Text style={styles.itemValue}>{item.value}</Text>
                </View>
                <Feather color={colors.mutedStrong} name="chevron-right" size={16} />
              </View>
            </Pressable>
          ))}
        </SurfaceCard>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>DATA & PRIVACY</Text>
        <SurfaceCard style={styles.group} tone="muted">
          {privacyItems.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => router.push(item.href)}
              style={({ pressed }) => [
                styles.infoCard,
                index === privacyItems.length - 1 ? styles.infoCardLast : null,
                pressed ? styles.infoCardPressed : null,
              ]}>
              <View style={styles.itemRow}>
                <MaterialCommunityIcons color={colors.mutedStrong} name={item.icon} size={20} />
                <View style={styles.itemText}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Text style={styles.itemValue}>{item.value}</Text>
                </View>
                <Feather color={colors.mutedStrong} name="chevron-right" size={16} />
              </View>
            </Pressable>
          ))}
        </SurfaceCard>
      </View>

      <View style={styles.footerSpacer} />

      <ActionButton
        disabled={isSigningOut}
        icon={
          isSigningOut ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <Feather color={colors.danger} name="log-out" size={15} />
          )
        }
        label="Sign Out"
        onPress={handleSignOut}
        tone="danger"
      />
    </AppScreen>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    avatarBox: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.pill,
      height: 64,
      justifyContent: 'center',
      width: 64,
    },
    avatarRing: {
      alignItems: 'center',
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 78,
      justifyContent: 'center',
      width: 78,
    },
    avatarText: {
      color: colors.teal,
      fontSize: 22,
      fontWeight: '800',
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
      paddingBottom: 16,
    },
    deptPill: {
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    deptPillText: {
      color: colors.mutedStrong,
      fontSize: type.tiny,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    errorMessage: {
      marginTop: 14,
    },
    eyebrow: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    footerSpacer: {
      flex: 1,
      minHeight: layout.footerSpacer,
    },
    group: {
      marginTop: 12,
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    heroGradient: {
      alignItems: 'center',
      marginTop: 18,
      paddingHorizontal: 20,
      paddingVertical: 26,
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
    infoCard: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    infoCardLast: {
      borderBottomWidth: 0,
    },
    infoCardPressed: {
      opacity: 0.86,
    },
    itemLabel: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '700',
    },
    itemRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
    },
    itemText: {
      flex: 1,
      gap: 6,
    },
    itemValue: {
      color: colors.mutedStrong,
      fontSize: 13,
    },
    meta: {
      color: colors.mutedStrong,
      fontSize: 14,
      marginTop: 4,
    },
    name: {
      color: colors.text,
      fontSize: type.title + 4,
      fontWeight: '800',
      marginTop: 14,
    },
    section: {
      marginTop: 18,
    },
    sectionLabel: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    statCard: {
      minHeight: 68,
      paddingVertical: 11,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
    },
  });
}
