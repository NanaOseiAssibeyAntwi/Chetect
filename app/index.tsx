import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { useEntryAccents, type EntryAccent } from '@/components/entry-shell';
import { layout, radius, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';

type RoleDefinition = {
  accent: EntryAccent;
  description: string;
  href: '/sign-in' | '/invigilator-sign-in';
  icon: (color: string) => React.ReactNode;
  meta: string;
  title: string;
};

const roleDefinitions: readonly RoleDefinition[] = [
  {
    accent: 'teal',
    description: 'Enter scheduled exams and view your session records.',
    href: '/sign-in',
    icon: (color) => <Feather color={color} name="user-check" size={22} />,
    meta: 'Student portal',
    title: 'Student',
  },
  {
    accent: 'warning',
    description: 'Create sessions, monitor activity, and review alerts.',
    href: '/invigilator-sign-in',
    icon: (color) => <MaterialCommunityIcons color={color} name="shield-account-outline" size={23} />,
    meta: 'Staff portal',
    title: 'Invigilator',
  },
] as const;

export default function LandingScreen() {
  const { colors } = useAppTheme();
  const accents = useEntryAccents();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.backgroundLayer} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBlock}>
          <View style={styles.brandStage}>
            <BrandMark accent="teal" size={64} />
          </View>

          <Text style={styles.brandLabel}>KNUST exam access</Text>
          <Text style={styles.heroLine}>Chetect</Text>
          <Text style={styles.heroCopy}>Secure exam entry for students and invigilators.</Text>
        </View>

        <View style={styles.selectorHeader}>
          <Text style={styles.sectionLabel}>Continue as</Text>
        </View>

        <View style={styles.roleList}>
          {roleDefinitions.map((role) => {
            const tone = accents[role.accent];

            return (
              <Pressable
                key={role.title}
                android_ripple={{ color: tone.soft }}
                onPress={() => router.push(role.href)}
                style={({ pressed }) => [
                  styles.roleCard,
                  { backgroundColor: colors.panel, borderColor: tone.border },
                  pressed && styles.roleCardPressed,
                ]}>
                <View style={[styles.roleAccent, { backgroundColor: tone.accent }]} />
                <View
                  style={[
                    styles.roleIconBox,
                    { backgroundColor: colors.panelSoft, borderColor: tone.border },
                  ]}>
                  {role.icon(tone.accent)}
                </View>
                <View style={styles.roleTextBlock}>
                  <View style={[styles.roleMetaPill, { backgroundColor: tone.soft }]}>
                    <Text style={[styles.roleMeta, { color: tone.accent }]}>{role.meta}</Text>
                  </View>
                  <Text style={styles.roleTitle}>{role.title}</Text>
                  <Text style={styles.roleDescription}>{role.description}</Text>
                </View>
                <View style={[styles.roleArrow, { borderColor: colors.borderStrong }]}>
                  <Feather color={colors.text} name="arrow-right" size={18} />
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.footerPill}>
          <Feather color={colors.success} name="lock" size={13} />
          <Text style={styles.footerText}>Verified institutional access</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    backgroundLayer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background,
    },
    brandLabel: {
      color: colors.mutedStrong,
      fontSize: type.body,
      fontWeight: '800',
      letterSpacing: 1.2,
      marginTop: 20,
      textTransform: 'uppercase',
    },
    brandStage: {
      alignItems: 'center',
      height: 72,
      justifyContent: 'center',
      width: 72,
    },
    content: {
      alignSelf: 'center',
      alignItems: 'stretch',
      flexGrow: 1,
      justifyContent: 'flex-start',
      maxWidth: layout.maxWidth,
      paddingBottom: layout.bottomPadding + 6,
      paddingHorizontal: layout.screenPadding,
      paddingTop: 42,
      width: '100%',
    },
    footerPill: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 7,
      marginTop: 18,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    footerText: {
      color: colors.mutedStrong,
      fontSize: type.body,
      fontWeight: '800',
    },
    heroBlock: {
      alignItems: 'flex-start',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      marginBottom: 24,
      paddingBottom: 22,
      paddingTop: 8,
      width: '100%',
    },
    heroCopy: {
      color: colors.muted,
      fontSize: type.bodyLarge,
      lineHeight: 22,
      marginTop: 8,
      maxWidth: 360,
    },
    heroLine: {
      color: colors.text,
      fontSize: type.hero,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: type.hero + 8,
    },
    roleAccent: {
      borderBottomLeftRadius: radius.md,
      borderTopLeftRadius: radius.md,
      bottom: 0,
      left: 0,
      position: 'absolute',
      top: 0,
      width: 5,
    },
    roleArrow: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    roleCard: {
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 14,
      minHeight: 112,
      overflow: 'hidden',
      paddingBottom: 16,
      paddingLeft: 22,
      paddingRight: 14,
      paddingTop: 16,
    },
    roleCardPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.995 }],
    },
    roleDescription: {
      color: colors.muted,
      fontSize: type.body,
      lineHeight: 18,
    },
    roleIconBox: {
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
    roleList: {
      gap: 14,
      width: '100%',
    },
    roleMeta: {
      fontSize: type.tiny,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
    },
    roleMetaPill: {
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    roleTextBlock: {
      flex: 1,
      gap: 5,
    },
    roleTitle: {
      color: colors.text,
      fontSize: type.title + 1,
      fontWeight: '800',
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1,
    },
    sectionLabel: {
      color: colors.muted,
      fontSize: type.body,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    selectorHeader: {
      alignItems: 'flex-start',
      marginBottom: 12,
    },
  });
}
