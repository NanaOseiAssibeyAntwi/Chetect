import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { useEntryAccents, type EntryAccent } from '@/components/entry-shell';
import { font, layout, radius, shadow, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';

type RoleDefinition = {
  accent: EntryAccent;
  href: '/sign-in' | '/invigilator-sign-in';
  icon: (color: string) => ReactNode;
  label: string;
  title: string;
};

const roleDefinitions: readonly RoleDefinition[] = [
  {
    accent: 'teal',
    href: '/sign-in',
    icon: (color) => <MaterialCommunityIcons color={color} name="school-outline" size={27} />,
    label: 'Exam portal',
    title: 'Student',
  },
  {
    accent: 'warning',
    href: '/invigilator-sign-in',
    icon: (color) => <MaterialCommunityIcons color={color} name="shield-account-outline" size={28} />,
    label: 'Staff portal',
    title: 'Invigilator',
  },
] as const;

export default function LandingScreen() {
  const { colors } = useAppTheme();
  const accents = useEntryAccents();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandBlock}>
          <View style={styles.brandFrame}>
            <BrandMark accent="teal" size={72} />
          </View>
          <Text style={styles.institution}>KNUST</Text>
          <Text style={styles.brandTitle}>Chetect</Text>
        </View>

        <View style={styles.selectorBlock}>
          <View style={styles.selectorRule} />
          <Text style={styles.selectorText}>Choose your portal</Text>
          <View style={styles.selectorRule} />
        </View>

        <View style={styles.roleStack}>
          {roleDefinitions.map((role) => {
            const tone = accents[role.accent];

            return (
              <Pressable
                key={role.title}
                android_ripple={{ color: tone.soft }}
                onPress={() => router.push(role.href)}
                style={({ pressed }) => [
                  styles.roleButton,
                  {
                    backgroundColor: colors.panel,
                    borderColor: pressed ? tone.accent : colors.border,
                  },
                  pressed ? styles.roleButtonPressed : null,
                ]}>
                <View style={[styles.roleMark, { backgroundColor: tone.accent }]} />
                <View style={[styles.roleIcon, { backgroundColor: tone.soft, borderColor: tone.border }]}>
                  {role.icon(tone.accent)}
                </View>
                <View style={styles.roleText}>
                  <Text style={styles.roleTitle}>{role.title}</Text>
                  <Text style={[styles.roleLabel, { color: tone.accent }]}>{role.label}</Text>
                </View>
                <View style={[styles.roleArrow, { backgroundColor: tone.soft, borderColor: tone.border }]}>
                  <Feather color={tone.accent} name="arrow-right" size={18} />
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Feather color={colors.success} name="lock" size={13} />
          <Text style={styles.footerText}>Secure institutional access</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    brandBlock: {
      alignItems: 'center',
      marginBottom: 30,
    },
    brandFrame: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      height: 98,
      justifyContent: 'center',
      width: 98,
      ...shadow.raised,
    },
    brandTitle: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.hero + 1,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: type.hero + 8,
      marginTop: 5,
      textAlign: 'center',
    },
    content: {
      alignSelf: 'center',
      flexGrow: 1,
      justifyContent: 'center',
      maxWidth: layout.maxWidth,
      paddingBottom: layout.bottomPadding,
      paddingHorizontal: layout.screenPadding,
      paddingTop: 30,
      width: '100%',
    },
    footer: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.successSoft,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 7,
      marginTop: 22,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    footerText: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '800',
    },
    institution: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 2,
      marginTop: 18,
      textAlign: 'center',
    },
    roleArrow: {
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    roleButton: {
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 14,
      minHeight: 98,
      overflow: 'hidden',
      paddingLeft: 20,
      paddingRight: 14,
      paddingVertical: 16,
      ...shadow.card,
    },
    roleButtonPressed: {
      opacity: 0.94,
      transform: [{ scale: 0.995 }],
    },
    roleIcon: {
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    roleLabel: {
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
      marginTop: 4,
    },
    roleMark: {
      bottom: 16,
      borderRadius: radius.pill,
      left: 10,
      position: 'absolute',
      top: 16,
      width: 4,
    },
    roleStack: {
      gap: 12,
      width: '100%',
    },
    roleText: {
      flex: 1,
      minWidth: 0,
    },
    roleTitle: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.title + 4,
      fontWeight: '900',
      lineHeight: 28,
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1,
    },
    selectorBlock: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    selectorRule: {
      backgroundColor: colors.border,
      flex: 1,
      height: 1,
    },
    selectorText: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
  });
}
