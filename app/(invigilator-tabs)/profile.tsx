import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
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
  fetchInvigilatorProfileData,
  type InvigilatorProfileData,
} from '@/lib/invigilator-sessions';
import { supabase } from '@/lib/supabase';

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
        icon: 'bell-outline' as const,
        label: 'Notifications',
        value: `${profileData?.unreadNotifications ?? 0} unread alerts`,
      },
      {
        icon: 'shield-lock-outline' as const,
        label: 'Access Role',
        value: `${roleLabel(profileData?.role ?? 'invigilator')} - ${profileData?.stats.level ?? 'L2'}`,
      },
      {
        icon: 'fingerprint' as const,
        label: 'Biometric Login',
        value: 'Enabled on this device',
      },
    ],
    [profileData]
  );

  const supportItems = useMemo(
    () => [
      {
        icon: 'file-document-outline' as const,
        label: 'Audit History',
        value: `${profileData?.stats.sessions ?? 0} monitored sessions`,
      },
      { icon: 'help-circle-outline' as const, label: 'Help & Support', value: 'Guides, contact IT' },
    ],
    [profileData]
  );

  const handleSignOut = async () => {
    setErrorMessage('');
    setIsSigningOut(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      router.replace('/invigilator-sign-in');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>INVIGILATOR PROFILE</Text>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={palette.warning} size="small" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable onPress={() => void loadProfile()} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.heroCard}>
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
          <Feather color={palette.warning} name="shield" size={18} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>OVERSIGHT RECORD</Text>
          <View style={styles.statsRow}>
            {stats.map((item) => (
              <View key={item.label} style={styles.statCard}>
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.group}>
            {accountItems.map((item) => (
              <Pressable key={item.label} style={styles.infoCard}>
                <View style={styles.itemRow}>
                  <MaterialCommunityIcons color={palette.warning} name={item.icon} size={20} />
                  <View style={styles.itemText}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    <Text style={styles.itemValue}>{item.value}</Text>
                  </View>
                  <Feather color={palette.mutedStrong} name="chevron-right" size={16} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SUPPORT</Text>
          <View style={styles.group}>
            {supportItems.map((item) => (
              <Pressable key={item.label} style={styles.infoCard}>
                <View style={styles.itemRow}>
                  <MaterialCommunityIcons color={palette.warning} name={item.icon} size={20} />
                  <View style={styles.itemText}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    <Text style={styles.itemValue}>{item.value}</Text>
                  </View>
                  <Feather color={palette.mutedStrong} name="chevron-right" size={16} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.footerSpacer} />

        <Pressable
          disabled={isSigningOut}
          onPress={handleSignOut}
          style={[styles.signOutButton, isSigningOut ? styles.signOutButtonDisabled : null]}>
          {isSigningOut ? (
            <ActivityIndicator color="#ff5a61" size="small" />
          ) : (
            <Feather color="#ff5a61" name="log-out" size={15} />
          )}
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatarBox: {
    alignItems: 'center',
    borderColor: palette.warning,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  avatarText: {
    color: palette.warning,
    fontSize: 18,
    fontWeight: '800',
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: layout.maxWidth,
    paddingBottom: 16,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  errorCard: {
    alignItems: 'flex-start',
    backgroundColor: '#2f1116',
    borderColor: '#8f2d37',
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  errorText: {
    color: '#ff9ea8',
    fontSize: type.body,
  },
  eyebrow: {
    color: palette.mutedStrong,
    fontSize: type.label,
    letterSpacing: 2.2,
    marginTop: 4,
  },
  footerSpacer: {
    flex: 1,
    minHeight: layout.footerSpacer,
  },
  group: {
    borderTopColor: palette.border,
    borderTopWidth: 1,
    marginTop: 12,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  heroText: {
    flex: 1,
  },
  infoCard: {
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  itemLabel: {
    color: palette.text,
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
    color: palette.mutedStrong,
    fontSize: 13,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  loadingText: {
    color: palette.mutedStrong,
    fontSize: type.body,
  },
  meta: {
    color: palette.mutedStrong,
    fontSize: 14,
    marginTop: 4,
  },
  metaSmall: {
    color: palette.mutedStrong,
    fontSize: 12,
    marginTop: 3,
  },
  name: {
    color: palette.text,
    fontSize: type.title + 2,
    fontWeight: '800',
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
  section: {
    marginTop: 18,
  },
  sectionLabel: {
    color: palette.mutedStrong,
    fontSize: type.label,
    letterSpacing: 2.2,
  },
  signOutButton: {
    alignItems: 'center',
    borderColor: '#64131e',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  signOutButtonDisabled: {
    opacity: 0.7,
  },
  signOutText: {
    color: '#ff5a61',
    fontSize: type.bodyLarge,
    fontWeight: '700',
  },
  statCard: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  statLabel: {
    color: palette.mutedStrong,
    fontSize: type.tiny,
    letterSpacing: 1.2,
  },
  statValue: {
    color: palette.warning,
    fontSize: type.display,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
});
