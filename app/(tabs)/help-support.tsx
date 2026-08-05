import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, SurfaceCard } from '@/components/product-ui';
import { layout, radius, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';

const supportItems = [
  {
    icon: 'account-lock-outline',
    title: 'Account Access',
    value: 'Student ID, password, and role issues',
  },
  {
    icon: 'camera-outline',
    title: 'Exam Monitoring',
    value: 'Camera permission, live analysis, and alert concerns',
  },
  {
    icon: 'file-document-outline',
    title: 'Results',
    value: 'Submitted exam scores and session records',
  },
] as const;

export default function HelpSupportScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <AppScreen contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(tabs)/profile')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <Text style={styles.eyebrow}>HELP & SUPPORT</Text>
      </View>

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons color={colors.teal} name="help-circle-outline" size={26} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>Academic IT Support</Text>
          <Text style={styles.meta}>Use your department help desk for urgent exam access issues.</Text>
        </View>
      </SurfaceCard>

      <View style={styles.list}>
        {supportItems.map((item) => (
          <SurfaceCard key={item.title} tone="muted">
            <View style={styles.supportRow}>
              <View style={styles.supportIcon}>
                <MaterialCommunityIcons color={colors.teal} name={item.icon} size={20} />
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
          Contact academic IT with your student ID, course code, exam title, and a short description of the issue.
        </Text>
        <ActionButton
          containerStyle={styles.profileButton}
          icon={<Feather color={colors.background} name="user" size={15} />}
          label="Back to Profile"
          onPress={() => router.navigate('/(tabs)/profile')}
          tone="primary"
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
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    contactCard: {
      marginTop: 18,
    },
    contactCopy: {
      color: colors.mutedStrong,
      fontSize: type.bodyLarge,
      lineHeight: 22,
      marginTop: 8,
    },
    contactTitle: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '800',
    },
    content: {
      paddingBottom: layout.bottomPadding,
    },
    eyebrow: {
      color: colors.mutedStrong,
      fontSize: type.label,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    heroCard: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      marginTop: 18,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.tealSoft,
      borderColor: colors.border,
      borderRadius: radius.pill,
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
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 6,
    },
    profileButton: {
      marginTop: 18,
    },
    supportIcon: {
      alignItems: 'center',
      backgroundColor: colors.tealSoft,
      borderColor: colors.border,
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
    },
    supportTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '800',
    },
    supportValue: {
      color: colors.mutedStrong,
      fontSize: type.body,
      lineHeight: 19,
      marginTop: 5,
    },
    title: {
      color: colors.text,
      fontSize: type.title + 2,
      fontWeight: '800',
    },
  });
}
