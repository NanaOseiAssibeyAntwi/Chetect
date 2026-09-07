import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, InlineMessage, MetricTile, SurfaceCard } from '@/components/product-ui';
import { font, layout, radius, shadow, type } from '@/constants/design';
import { useCachedResource } from '@/hooks/use-cached-resource';
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
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutErrorMessage, setSignOutErrorMessage] = useState('');
  const {
    data: profileData,
    errorMessage,
    isLoading,
    refresh: refreshProfile,
  } = useCachedResource<InvigilatorProfileData | null>({
    initialData: null,
    key: 'invigilator.profile',
    loader: fetchInvigilatorProfileData,
    maxAgeMs: 60_000,
  });

  useFocusEffect(
    useCallback(() => {
      void refreshProfile({ showLoader: profileData === null });
      return undefined;
    }, [profileData, refreshProfile])
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

  const performSignOut = async () => {
    setSignOutErrorMessage('');
    setIsSigningOut(true);

    try {
      await signOut();
      router.replace('/invigilator-sign-in');
    } catch (error) {
      setSignOutErrorMessage(error instanceof Error ? error.message : 'Unable to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSignOut = () => {
    if (isSigningOut) {
      return;
    }

    Alert.alert('Sign out?', 'Are you sure you want to sign out of this invigilator account?', [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: () => {
          void performSignOut();
        },
        style: 'destructive',
        text: 'Sign Out',
      },
    ]);
  };

  return (
    <AppScreen accent="warning" contentContainerStyle={styles.content} scroll={false}>
      <View style={styles.heroHeader}>
        <View style={styles.heroTopRow}>
          <View style={styles.eyebrowPill}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>INVIGILATOR PROFILE</Text>
          </View>
          <View style={styles.levelChip}>
            <Text style={styles.levelChipText}>{profileData?.stats.level ?? 'L2'}</Text>
          </View>
        </View>

        <View style={styles.heroBody}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{toInitials(profileData?.staffName ?? 'Invigilator')}</Text>
          </View>
          <View style={styles.heroText}>
            <Text numberOfLines={2} style={styles.name}>
              {profileData?.staffName ?? 'Invigilator'}
            </Text>
            <Text style={styles.meta}>{formatStaffId(profileData?.staffId ?? null)}</Text>
            <Text numberOfLines={1} style={styles.metaSmall}>
              {roleLabel(profileData?.role ?? 'invigilator')}
              {profileData?.departmentName ? ` - ${profileData.departmentName}` : ''}
            </Text>
          </View>
        </View>
      </View>

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
                onPress={() => void refreshProfile({ force: true })}
                tone="danger"
              />
          }
          description={errorMessage}
          style={styles.errorMessage}
          tone="danger"
        />
      ) : null}

      {signOutErrorMessage ? (
        <InlineMessage description={signOutErrorMessage} style={styles.errorMessage} tone="danger" />
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollArea}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionLabel}>OVERSIGHT RECORD</Text>
              <Text style={styles.sectionMeta}>Current invigilator activity</Text>
            </View>
            <Feather color={colors.mutedStrong} name="activity" size={18} />
          </View>
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>ACCOUNT</Text>
            <Feather color={colors.mutedStrong} name="settings" size={18} />
          </View>
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>SUPPORT</Text>
            <Feather color={colors.mutedStrong} name="life-buoy" size={18} />
          </View>
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

        <View style={styles.signOutWrap}>
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
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    content: {
      paddingTop: 4,
    },
    avatarBox: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 58,
      justifyContent: 'center',
      width: 58,
    },
    avatarText: {
      color: colors.warning,
      fontFamily: font.display,
      fontSize: 19,
      fontWeight: '900',
    },
    errorMessage: {
      marginTop: 14,
    },
    eyebrow: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: type.label,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    eyebrowDot: {
      backgroundColor: colors.warning,
      borderRadius: radius.pill,
      height: 7,
      width: 7,
    },
    eyebrowPill: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    footerSpacer: {
      flex: 1,
      minHeight: layout.footerSpacer,
    },
    group: {
      padding: 0,
    },
    heroBody: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      marginTop: 18,
    },
    heroHeader: {
      backgroundColor: colors.panel,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 16,
      ...shadow.raised,
    },
    heroText: {
      flex: 1,
      minWidth: 0,
    },
    heroTopRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    infoCard: {
      borderBottomColor: colors.borderSoft,
      borderBottomWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    infoCardLast: {
      borderBottomWidth: 0,
    },
    infoCardPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.99 }],
    },
    itemIconBox: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    itemLabel: {
      color: colors.text,
      fontFamily: font.body,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    itemRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
    },
    itemText: {
      flex: 1,
      gap: 5,
      minWidth: 0,
    },
    itemValue: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: 13,
      lineHeight: 18,
    },
    levelChip: {
      alignItems: 'center',
      backgroundColor: colors.panelRaised,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 34,
      paddingHorizontal: 12,
    },
    levelChipText: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.7,
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
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '700',
    },
    meta: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 5,
    },
    metaSmall: {
      color: colors.muted,
      fontFamily: font.body,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginTop: 5,
      textTransform: 'uppercase',
    },
    name: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.display,
      fontWeight: '900',
      lineHeight: type.display + 4,
    },
    section: {
      marginTop: 16,
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    sectionLabel: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.label,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    sectionMeta: {
      color: colors.muted,
      fontFamily: font.body,
      fontSize: 12,
      marginTop: 3,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
    },
    scrollArea: {
      flex: 1,
      marginTop: 14,
    },
    scrollContent: {
      paddingBottom: 0,
    },
    signOutWrap: {
      marginTop: 0,
    },
  });
}
