import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, InlineMessage, MetricTile, SurfaceCard } from '@/components/product-ui';
import { layout, radius, shadow, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  fetchInvigilatorProfileData,
  type InvigilatorProfileData,
} from '@/lib/invigilator-sessions';
import { useSession } from '@/providers/session-provider';

type FeatherIconName = ComponentProps<typeof Feather>['name'];
type InvigilatorProfileActionHref =
  | '/(invigilator-tabs)/access-role'
  | '/(invigilator-tabs)/audit-history'
  | '/(invigilator-tabs)/help-support'
  | '/(invigilator-tabs)/notifications';
type InvigilatorProfileActionItem = {
  href: InvigilatorProfileActionHref;
  icon: FeatherIconName;
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

  return initials || 'IN';
}

function roleLabel(role: InvigilatorProfileData['role']) {
  return role.toUpperCase();
}

function formatStaffId(staffId: string | null) {
  return staffId ? staffId.toUpperCase() : 'STAFF ID NOT SET';
}

export default function InvigilatorProfileScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { signOut } = useSession();
  const [profileData, setProfileData] = useState<InvigilatorProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await fetchInvigilatorProfileData();
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
      { label: 'SESSIONS', value: String(profileData?.stats.sessions ?? 0) },
      { label: 'AVG TRUST', value: String(profileData?.stats.averageTrust ?? 0) },
      { label: 'LEVEL', value: profileData?.stats.level ?? 'L2' },
    ],
    [profileData]
  );

  const accountItems = useMemo(
    () => [
      {
        href: '/(invigilator-tabs)/notifications',
        icon: 'bell' as const,
        label: 'Notifications',
        value: `${profileData?.unreadNotifications ?? 0} unread alerts`,
      },
      {
        href: '/(invigilator-tabs)/access-role',
        icon: 'shield' as const,
        label: 'Access Role',
        value: `${roleLabel(profileData?.role ?? 'invigilator')} - ${profileData?.stats.level ?? 'L2'}`,
      },
    ] satisfies InvigilatorProfileActionItem[],
    [profileData]
  );

  const supportItems = useMemo(
    () => [
      {
        href: '/(invigilator-tabs)/audit-history',
        icon: 'clipboard' as const,
        label: 'Audit History',
        value: `${profileData?.stats.sessions ?? 0} monitored sessions`,
      },
      {
        href: '/(invigilator-tabs)/help-support',
        icon: 'help-circle' as const,
        label: 'Help & Support',
        value: 'Guides, contact IT',
      },
    ] satisfies InvigilatorProfileActionItem[],
    [profileData]
  );

  const handleSignOut = async () => {
    setErrorMessage('');
    setIsSigningOut(true);

    try {
      await signOut();
      router.replace('/invigilator-sign-in');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <AppScreen accent="warning">
      <Text style={styles.eyebrow}>INVIGILATOR PROFILE</Text>

      {isLoading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.warning} size="small" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
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

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>{toInitials(profileData?.staffName ?? 'Invigilator')}</Text>
        </View>
        <View style={styles.heroText}>
          <Text style={styles.name}>{profileData?.staffName ?? 'Invigilator'}</Text>
          <Text style={styles.meta}>{formatStaffId(profileData?.staffId ?? null)}</Text>
          <Text style={styles.metaSmall}>
            ROLE: {roleLabel(profileData?.role ?? 'invigilator')}
            {profileData?.departmentName ? `   ${profileData.departmentName}` : ''}
          </Text>
        </View>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>{profileData?.stats.level ?? 'L2'}</Text>
        </View>
      </SurfaceCard>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>OVERSIGHT RECORD</Text>
        <View style={styles.statsRow}>
          {stats.map((item) => (
            <MetricTile
              accentColor={colors.warning}
              key={item.label}
              label={item.label}
              value={item.value}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <SurfaceCard style={styles.group}>
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
                <View style={styles.itemIconBox}>
                  <Feather color={colors.warning} name={item.icon} size={19} />
                </View>
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
        <Text style={styles.sectionLabel}>SUPPORT</Text>
        <SurfaceCard style={styles.group}>
          {supportItems.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => router.push(item.href)}
              style={({ pressed }) => [
                styles.infoCard,
                index === supportItems.length - 1 ? styles.infoCardLast : null,
                pressed ? styles.infoCardPressed : null,
              ]}>
              <View style={styles.itemRow}>
                <View style={styles.itemIconBox}>
                  <Feather color={colors.warning} name={item.icon} size={19} />
                </View>
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
      backgroundColor: colors.warningSoft,
      borderRadius: radius.pill,
      height: 50,
      justifyContent: 'center',
      width: 50,
    },
    avatarText: {
      color: colors.warning,
      fontSize: 18,
      fontWeight: '800',
    },
    errorMessage: {
      marginTop: 14,
    },
    eyebrow: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginTop: 4,
      textTransform: 'uppercase',
    },
    footerSpacer: {
      flex: 1,
      minHeight: layout.footerSpacer,
    },
    group: {
      padding: 0,
    },
    heroBadge: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderRadius: radius.pill,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    heroBadgeText: {
      color: colors.warning,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    heroCard: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      marginTop: 18,
    },
    heroText: {
      flex: 1,
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
    itemIconBox: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderRadius: radius.sm,
      height: 36,
      justifyContent: 'center',
      width: 36,
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
    loadingCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      ...shadow.card,
    },
    loadingText: {
      color: colors.mutedStrong,
      fontSize: type.body,
    },
    meta: {
      color: colors.mutedStrong,
      fontSize: 14,
      marginTop: 4,
    },
    metaSmall: {
      color: colors.mutedStrong,
      fontSize: 12,
      marginTop: 3,
    },
    name: {
      color: colors.text,
      fontSize: type.title + 2,
      fontWeight: '800',
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
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
    },
  });
}
