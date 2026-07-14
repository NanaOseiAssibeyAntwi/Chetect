import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, palette, radius, shadow, type } from '@/constants/design';

const roles = [
  {
    accent: palette.teal,
    description: 'Join a scheduled exam session',
    href: '/sign-in' as const,
    icon: <Feather color={palette.teal} name="user" size={20} />,
    title: 'Student',
  },
  {
    accent: palette.warning,
    href: '/invigilator-sign-in' as const,
    description: 'Create and monitor exam sessions',
    icon: <MaterialCommunityIcons color={palette.warning} name="lock-outline" size={20} />,
    title: 'Invigilator',
  },
] as const;

export default function LandingScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBlock}>
          <View style={styles.brandDot} />
          <Text style={styles.heroLine}>Chetect</Text>
          <Text style={styles.heroCopy}>
            Minimal exam access for KNUST students and invigilators.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Continue as</Text>

        <View style={styles.roleList}>
          {roles.map((role) => (
            <Pressable
              key={role.title}
              android_ripple={{ color: palette.borderSoft }}
              onPress={() => router.push(role.href)}
              style={({ pressed }) => [
                styles.roleCard,
                pressed && styles.roleCardPressed,
              ]}>
              <View style={[styles.roleIconBox, { backgroundColor: role.title === 'Student' ? palette.tealSoft : palette.warningSoft }]}>
                {role.icon}
              </View>
              <View style={styles.roleTextBlock}>
                <Text style={styles.roleTitle}>{role.title}</Text>
                <Text style={styles.roleDescription}>{role.description}</Text>
              </View>
              <Feather color={role.accent} name="arrow-right" size={18} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brandDot: {
    backgroundColor: palette.teal,
    borderRadius: radius.pill,
    height: 8,
    marginBottom: 18,
    width: 8,
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: layout.maxWidth,
    paddingBottom: layout.bottomPadding + 6,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 4,
    width: '100%',
  },
  heroBlock: {
    marginBottom: 38,
  },
  heroCopy: {
    color: palette.mutedStrong,
    fontSize: type.bodyLarge,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 312,
  },
  heroLine: {
    color: palette.text,
    fontSize: type.hero,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: type.hero + 7,
  },
  roleCard: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 78,
    paddingHorizontal: 16,
    ...shadow.card,
  },
  roleCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  roleDescription: {
    color: palette.mutedStrong,
    fontSize: type.body,
  },
  roleIconBox: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  roleList: {
    gap: layout.cardGap,
  },
  roleTextBlock: {
    flex: 1,
    gap: 4,
  },
  roleTitle: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: '700',
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  sectionLabel: {
    color: palette.mutedStrong,
    fontSize: type.body,
    fontWeight: '700',
    marginBottom: 14,
  },
});
