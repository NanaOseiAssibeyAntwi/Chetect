import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, palette, radius, shadow, type } from '@/constants/design';
import { useSession } from '@/providers/session-provider';

type ProfileIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const stats = [
  { label: 'EXAMS', value: '4' },
  { label: 'AVG SCORE', value: '78%' },
  { label: 'TRUST IDX', value: '94' },
] as const;

const accountItems = [
  { icon: 'bell-outline', label: 'Notifications', value: 'Exam alerts, flags' },
  { icon: 'lock-outline', label: 'Change Password', value: 'Last changed 30 days ago' },
  { icon: 'shield-account-outline', label: 'Biometric Login', value: 'Enabled - Touch ID' },
] satisfies { icon: ProfileIconName; label: string; value: string }[];

const privacyItems = [
  { icon: 'file-document-outline', label: 'Session History', value: '4 completed sessions' },
  { icon: 'help-circle-outline', label: 'Help & Support', value: 'Docs, contact IT' },
] satisfies { icon: ProfileIconName; label: string; value: string }[];

export default function ProfileScreen() {
  const { signOut } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

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
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.navigate('/(tabs)')} style={styles.backButton}>
            <Feather color={palette.mutedStrong} name="chevron-left" size={18} />
          </Pressable>
          <Text style={styles.eyebrow}>PROFILE</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>KA</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.name}>Kwame Asante</Text>
            <Text style={styles.meta}>KNUST/CS/2021/0042</Text>
            <Text style={styles.metaSmall}>DEPT: Computer Science</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>INTEGRITY RECORD</Text>
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
                  <MaterialCommunityIcons color={palette.mutedStrong} name={item.icon} size={20} />
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
          <Text style={styles.sectionLabel}>DATA & PRIVACY</Text>
          <View style={styles.group}>
            {privacyItems.map((item) => (
              <Pressable key={item.label} style={styles.infoCard}>
                <View style={styles.itemRow}>
                  <MaterialCommunityIcons color={palette.mutedStrong} name={item.icon} size={20} />
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
            <ActivityIndicator color={palette.danger} size="small" />
          ) : (
            <Feather color={palette.danger} name="log-out" size={15} />
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
    backgroundColor: palette.tealSoft,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: palette.teal,
    fontSize: 18,
    fontWeight: '800',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: layout.maxWidth,
    paddingBottom: 16,
    paddingHorizontal: layout.screenPaddingWide,
    width: '100%',
  },
  eyebrow: {
    color: palette.mutedStrong,
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
    borderTopColor: palette.border,
    borderTopWidth: 1,
    marginTop: 12,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...shadow.card,
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
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: palette.dangerSoft,
    borderColor: '#fecaca',
    borderRadius: radius.md,
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
    color: palette.danger,
    fontSize: type.bodyLarge,
    fontWeight: '700',
  },
  statCard: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 11,
    ...shadow.card,
  },
  statLabel: {
    color: palette.mutedStrong,
    fontSize: type.tiny,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statValue: {
    color: palette.teal,
    fontSize: type.display,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
});
