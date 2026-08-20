import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, InlineMessage, SurfaceCard } from '@/components/product-ui';
import { layout, radius, shadow, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
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

function getIntegrityTone(score: number, colors: ReturnType<typeof useAppTheme>['colors']) {
  if (score >= 80) {
    return colors.success;
  }

  if (score >= 60) {
    return colors.warning;
  }

  return colors.danger;
}

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { signOut } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
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

  const integrityScore = profileData?.stats.integrity ?? 100;
  const integrityColor = getIntegrityTone(integrityScore, colors);
  const stats = useMemo(
    () => [
      {
        color: colors.teal,
        icon: 'clipboard-check-outline' as ProfileIconName,
        label: 'Exams',
        value: String(profileData?.stats.examsTaken ?? 0),
      },
      {
        color: colors.sky,
        icon: 'chart-line' as ProfileIconName,
        label: 'Avg score',
        value: `${profileData?.stats.averageScore ?? 0}%`,
      },
      {
        color: integrityColor,
        icon: 'shield-check-outline' as ProfileIconName,
        label: 'Integrity',
        value: String(integrityScore),
      },
    ],
    [colors.sky, colors.teal, integrityColor, integrityScore, profileData]
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

  const recordsItems = useMemo(
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

  const performSignOut = async () => {
    setIsSigningOut(true);

    try {
      await signOut();
      router.replace('/sign-in');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSignOut = () => {
    if (isSigningOut) {
      return;
    }

    Alert.alert(
      'Sign out?',
      'Are you sure you want to sign out of this student account?',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          onPress: () => {
            void performSignOut();
          },
          style: 'destructive',
          text: 'Sign out',
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <AppScreen accent="teal" contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(tabs)')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>PROFILE</Text>
          <Text style={styles.headerTitle}>Student account</Text>
        </View>
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
              onPress={() => void refreshProfile({ force: true })}
              tone="danger"
            />
          }
          description={errorMessage}
          style={styles.errorMessage}
          tone="danger"
        />
      ) : null}

      <View style={styles.identityCard}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>{toInitials(profileData?.studentName ?? 'Student')}</Text>
        </View>
        <View style={styles.identityText}>
          <Text numberOfLines={1} style={styles.name}>{profileData?.studentName ?? 'Student'}</Text>
          <Text numberOfLines={1} style={styles.meta}>
            {profileData?.studentId ? profileData.studentId.toUpperCase() : 'STUDENT ID NOT SET'}
          </Text>
          <View style={styles.deptPill}>
            <Text numberOfLines={1} style={styles.deptPillText}>
              {profileData?.departmentName ?? 'Department not set'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        {stats.map((item) => (
          <View key={item.label} style={styles.statCard}>
            <MaterialCommunityIcons color={item.color} name={item.icon} size={17} />
            <Text numberOfLines={1} style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
            <Text numberOfLines={1} style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <ProfileGroup colors={colors} items={accountItems} title="Account" />
      <ProfileGroup colors={colors} items={recordsItems} title="Records & Support" />

      <SurfaceCard style={styles.signOutCard} tone="muted">
        <View style={styles.signOutText}>
          <Text style={styles.signOutTitle}>Signed in on this device</Text>
          <Text style={styles.signOutCopy}>Sign out when you are done using a shared phone.</Text>
        </View>
        <ActionButton
          compact
          disabled={isSigningOut}
          fullWidth={false}
          icon={
            isSigningOut ? (
              <ActivityIndicator color={colors.danger} size="small" />
            ) : (
              <Feather color={colors.danger} name="log-out" size={15} />
            )
          }
          label={isSigningOut ? '' : 'Sign out'}
          onPress={handleSignOut}
          tone="danger"
        />
      </SurfaceCard>
    </AppScreen>
  );
}

function ProfileGroup({
  colors,
  items,
  title,
}: {
  colors: ReturnType<typeof useAppTheme>['colors'];
  items: ProfileActionItem[];
  title: string;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.actionList}>
        {items.map((item) => (
          <Pressable
            key={item.label}
            onPress={() => router.push(item.href)}
            style={({ pressed }) => [styles.actionRow, pressed ? styles.actionRowPressed : null]}>
            <View style={styles.actionIcon}>
              <MaterialCommunityIcons color={colors.teal} name={item.icon} size={20} />
            </View>
            <View style={styles.itemText}>
              <Text style={styles.itemLabel}>{item.label}</Text>
              <Text numberOfLines={1} style={styles.itemValue}>{item.value}</Text>
            </View>
            <Feather color={colors.mutedStrong} name="chevron-right" size={17} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    actionIcon: {
      alignItems: 'center',
      backgroundColor: colors.tealSoft,
      borderColor: colors.tealGlow,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    actionList: {
      gap: 10,
      marginTop: 10,
    },
    actionRow: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 70,
      paddingHorizontal: 13,
      paddingVertical: 13,
      ...shadow.card,
    },
    actionRowPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.99 }],
    },
    avatarBox: {
      alignItems: 'center',
      backgroundColor: colors.tealSoft,
      borderColor: colors.tealGlow,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 58,
      justifyContent: 'center',
      width: 58,
    },
    avatarText: {
      color: colors.teal,
      fontSize: 20,
      fontWeight: '900',
    },
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
    deptPill: {
      alignSelf: 'flex-start',
      backgroundColor: colors.panelSoft,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      marginTop: 8,
      maxWidth: '100%',
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    deptPillText: {
      color: colors.mutedStrong,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    errorMessage: {
      marginTop: 14,
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
    identityCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 14,
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      ...shadow.raised,
    },
    identityText: {
      flex: 1,
      minWidth: 0,
    },
    itemLabel: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    itemText: {
      flex: 1,
      gap: 5,
      minWidth: 0,
    },
    itemValue: {
      color: colors.mutedStrong,
      fontSize: type.body,
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
    meta: {
      color: colors.mutedStrong,
      fontSize: type.body,
      marginTop: 5,
    },
    name: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '900',
    },
    section: {
      marginTop: 20,
    },
    sectionLabel: {
      color: colors.text,
      fontSize: type.body,
      fontWeight: '900',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    signOutCard: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      marginTop: 20,
    },
    signOutCopy: {
      color: colors.mutedStrong,
      fontSize: type.body,
      lineHeight: 19,
      marginTop: 4,
    },
    signOutText: {
      flex: 1,
      minWidth: 0,
    },
    signOutTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    statCard: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      minHeight: 76,
      minWidth: 0,
      paddingHorizontal: 11,
      paddingVertical: 11,
      ...shadow.card,
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
    statValue: {
      fontSize: 20,
      fontWeight: '900',
      marginTop: 7,
    },
  });
}
