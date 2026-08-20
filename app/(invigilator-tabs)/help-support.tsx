import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, SurfaceCard } from '@/components/product-ui';
import { font, layout, radius, shadow, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';

const supportItems = [
  {
    icon: 'monitor' as const,
    title: 'Live Monitoring',
    value: 'Student session status, suspicious clips, and realtime refresh issues',
  },
  {
    icon: 'plus-circle' as const,
    title: 'Session Setup',
    value: 'Course details, MCQ entry, registration, and scheduling',
  },
  {
    icon: 'file-text' as const,
    title: 'Reports',
    value: 'Integrity summaries, flagged incidents, and export reviews',
  },
] satisfies { icon: React.ComponentProps<typeof Feather>['name']; title: string; value: string }[];

export default function InvigilatorHelpSupportScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <AppScreen accent="warning" contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.navigate('/(invigilator-tabs)/profile')}
          style={({ pressed }) => [styles.backButton, pressed ? styles.buttonPressed : null]}>
          <Feather color={colors.warning} name="chevron-left" size={17} />
          <Text style={styles.backButtonText}>Profile</Text>
        </Pressable>
        <Text style={styles.eyebrow}>HELP & SUPPORT</Text>
      </View>

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Feather color={colors.warning} name="help-circle" size={24} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>Invigilator Support</Text>
          <Text style={styles.meta}>Contact academic IT for account, monitoring, or evidence access issues.</Text>
        </View>
      </SurfaceCard>

      <View style={styles.list}>
        {supportItems.map((item) => (
          <SurfaceCard key={item.title} style={styles.supportCard} tone="muted">
            <View style={styles.supportRow}>
              <View style={styles.supportIcon}>
                <Feather color={colors.warning} name={item.icon} size={19} />
              </View>
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>{item.title}</Text>
                <Text style={styles.supportValue}>{item.value}</Text>
              </View>
            </View>
          </SurfaceCard>
        ))}
      </View>

      <SurfaceCard style={styles.contactCard}>
        <Text style={styles.contactTitle}>Need assistance?</Text>
        <Text style={styles.contactCopy}>
          Include your staff ID, course code, exam title, student ID when relevant, and the exact issue you saw.
        </Text>
        <ActionButton
          containerStyle={styles.profileButton}
          icon={<Feather color={colors.background} name="user" size={15} />}
          label="Back to Profile"
          onPress={() => router.navigate('/(invigilator-tabs)/profile')}
          tone="accent"
        />
      </SurfaceCard>
    </AppScreen>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    backButton: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.warningSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 5,
      minHeight: 38,
      justifyContent: 'center',
      paddingHorizontal: 12,
      ...shadow.card,
    },
    backButtonText: {
      color: colors.warning,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
    },
    buttonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.985 }],
    },
    contactCard: {
      borderLeftColor: colors.warning,
      borderLeftWidth: 4,
      marginTop: 18,
    },
    contactCopy: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.bodyLarge,
      lineHeight: 22,
      marginTop: 8,
    },
    contactTitle: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.title,
      fontWeight: '900',
    },
    content: {
      paddingBottom: layout.bottomPadding,
    },
    eyebrow: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.label,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    heroCard: {
      alignItems: 'center',
      borderColor: colors.borderStrong,
      flexDirection: 'row',
      gap: 14,
      marginTop: 18,
      ...shadow.raised,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 54,
      justifyContent: 'center',
      width: 54,
    },
    heroText: {
      flex: 1,
    },
    list: {
      gap: 12,
      marginTop: 18,
    },
    meta: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 6,
    },
    profileButton: {
      marginTop: 18,
    },
    supportIcon: {
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    supportRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    supportText: {
      flex: 1,
      minWidth: 0,
    },
    supportTitle: {
      color: colors.text,
      fontFamily: font.body,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    supportValue: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      lineHeight: 19,
      marginTop: 5,
    },
    supportCard: {
      borderLeftColor: colors.warning,
      borderLeftWidth: 3,
    },
    title: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.display,
      fontWeight: '900',
      lineHeight: type.display + 5,
    },
  });
}
