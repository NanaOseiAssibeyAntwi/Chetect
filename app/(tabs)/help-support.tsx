import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ActionButton, SurfaceCard } from '@/components/product-ui';
import { layout, radius, shadow, type } from '@/constants/design';
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
    <AppScreen accent="teal" contentContainerStyle={styles.content} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.navigate('/(tabs)/profile')} style={styles.backButton}>
          <Feather color={colors.mutedStrong} name="chevron-left" size={18} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>HELP & SUPPORT</Text>
          <Text style={styles.headerTitle}>Student support</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons color={colors.teal} name="lifebuoy" size={24} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>Academic IT Support</Text>
          <Text style={styles.meta}>Use your department help desk for urgent exam access issues.</Text>
        </View>
      </View>

      <View style={styles.list}>
        {supportItems.map((item) => (
          <View key={item.title} style={styles.supportCard}>
            <View style={styles.supportIcon}>
              <MaterialCommunityIcons color={colors.teal} name={item.icon} size={20} />
            </View>
            <View style={styles.supportText}>
              <Text style={styles.supportTitle}>{item.title}</Text>
              <Text style={styles.supportValue}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <SurfaceCard style={styles.contactCard} tone="muted">
        <View style={styles.contactHeader}>
          <Feather color={colors.teal} name="send" size={17} />
          <Text style={styles.contactTitle}>Need assistance?</Text>
        </View>
        <Text style={styles.contactCopy}>
          Contact academic IT with your student ID, course code, exam title, and a short description of the issue.
        </Text>
        <ActionButton
          containerStyle={styles.profileButton}
          icon={<Feather color="#ffffff" name="user" size={15} />}
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
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    contactCard: {
      marginTop: 18,
    },
    contactCopy: {
      color: colors.mutedStrong,
      fontSize: type.bodyLarge,
      lineHeight: 22,
      marginTop: 10,
    },
    contactHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 9,
    },
    contactTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    content: {
      paddingBottom: layout.bottomPadding,
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
    heroCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 13,
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 15,
      ...shadow.raised,
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.tealSoft,
      borderColor: colors.tealGlow,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    heroText: {
      flex: 1,
      minWidth: 0,
    },
    list: {
      gap: 12,
      marginTop: 16,
    },
    meta: {
      color: colors.mutedStrong,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 5,
    },
    profileButton: {
      marginTop: 16,
    },
    supportCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 76,
      paddingHorizontal: 14,
      paddingVertical: 14,
      ...shadow.card,
    },
    supportIcon: {
      alignItems: 'center',
      backgroundColor: colors.tealSoft,
      borderColor: colors.tealGlow,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    supportText: {
      flex: 1,
      minWidth: 0,
    },
    supportTitle: {
      color: colors.text,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    supportValue: {
      color: colors.mutedStrong,
      fontSize: type.body,
      lineHeight: 19,
      marginTop: 5,
    },
    title: {
      color: colors.text,
      fontSize: type.title,
      fontWeight: '900',
    },
  });
}
