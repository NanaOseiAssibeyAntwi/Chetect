import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { EntryBadge, EntryPanel, EntryScreen, useEntryAccents } from '@/components/entry-shell';
import { EntryField, EntryHeaderBar, EntryPrimaryAction } from '@/components/entry-auth';
import { font, radius, shadow, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';
import { signInInvigilator } from '@/lib/student-auth';

export default function InvigilatorSignInScreen() {
  const [staffId, setStaffId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { colors } = useAppTheme();
  const tone = useEntryAccents().warning;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const returnToLanding = useCallback(() => {
    router.replace('/');
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      returnToLanding();
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [returnToLanding]);

  const handleInvigilatorSignIn = async () => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      await signInInvigilator(staffId, password);
      router.replace('/(invigilator-tabs)');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sign-in failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <EntryScreen
      accent="warning"
      contentContainerStyle={styles.screenContent}
      header={<EntryHeaderBar accent="warning" label="Invigilator access" onBack={returnToLanding} />}
      keyboardAware>
      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Feather color={tone.accent} name="shield" size={28} />
        </View>
        <View style={styles.heroText}>
          <EntryBadge accent="warning" detail="STAFF" label="Secure portal" style={styles.badge} />
          <Text style={styles.title}>Invigilator Access</Text>
          <Text style={styles.subtitle}>Monitor live sessions, review alerts, and manage exam oversight.</Text>
        </View>
      </View>

      <View style={styles.quickRow}>
        <View style={styles.quickPill}>
          <Feather color={tone.accent} name="activity" size={14} />
          <Text style={styles.quickText}>Live monitoring</Text>
        </View>
        <View style={styles.quickPill}>
          <Feather color={colors.teal} name="file-text" size={14} />
          <Text style={styles.quickText}>Audit trail</Text>
        </View>
      </View>

      <EntryPanel accent="warning" style={styles.formPanel}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Staff credentials</Text>
          <Text style={styles.formSubtitle}>Use your approved invigilator account.</Text>
        </View>

        <EntryField
          accent="warning"
          autoCapitalize="none"
          autoCorrect={false}
          icon={<Feather color={tone.accent} name="briefcase" size={18} />}
          label="Staff ID"
          onChangeText={setStaffId}
          placeholder="Staff ID or username"
          value={staffId}
        />

        <EntryField
          accent="warning"
          autoCapitalize="none"
          autoCorrect={false}
          icon={<Feather color={tone.accent} name="lock" size={18} />}
          label="Password"
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry={!showPassword}
          trailing={
            <Pressable hitSlop={10} onPress={() => setShowPassword((value) => !value)}>
              <Feather color={colors.muted} name={showPassword ? 'eye-off' : 'eye'} size={18} />
            </Pressable>
          }
          value={password}
        />

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Feather color={colors.danger} name="alert-triangle" size={16} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}
      </EntryPanel>

      <View style={styles.clearanceCard}>
        <View style={[styles.clearanceIcon, { backgroundColor: tone.soft }]}>
          <Feather color={tone.accent} name="lock" size={19} />
        </View>
        <View style={styles.clearanceText}>
          <Text style={styles.clearanceTitle}>Elevated access</Text>
          <Text style={styles.clearanceMeta}>Only authorized staff can open live session controls and reports.</Text>
        </View>
      </View>

      <EntryPrimaryAction
        accent="warning"
        isLoading={isLoading}
        label="Sign in as invigilator"
        onPress={handleInvigilatorSignIn}
      />

      <View style={[styles.securityBar, { backgroundColor: tone.soft, borderColor: tone.border }]}>
        <Feather color={tone.accent} name="shield" size={14} />
        <Text style={styles.securityLabel}>Access level</Text>
        <Text style={[styles.securityText, { color: tone.accent }]}>Invigilator</Text>
      </View>
    </EntryScreen>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
    },
    clearanceCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      marginTop: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      ...shadow.card,
    },
    clearanceIcon: {
      alignItems: 'center',
      borderRadius: radius.md,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    clearanceMeta: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      lineHeight: 19,
      marginTop: 4,
    },
    clearanceText: {
      flex: 1,
      minWidth: 0,
    },
    clearanceTitle: {
      color: colors.text,
      fontFamily: font.body,
      fontSize: type.bodyLarge,
      fontWeight: '900',
    },
    errorBox: {
      alignItems: 'flex-start',
      backgroundColor: colors.dangerSoft,
      borderColor: colors.dangerSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    errorText: {
      color: colors.danger,
      flex: 1,
      fontFamily: font.body,
      fontSize: type.body,
      lineHeight: 20,
    },
    formHeader: {
      gap: 5,
    },
    formPanel: {
      gap: 16,
      marginTop: 16,
    },
    formSubtitle: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
    },
    formTitle: {
      color: colors.text,
      fontFamily: font.body,
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
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
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
      minWidth: 0,
    },
    quickPill: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: 7,
      justifyContent: 'center',
      minHeight: 38,
      paddingHorizontal: 10,
      ...shadow.card,
    },
    quickRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    quickText: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.tiny,
      fontWeight: '900',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    screenContent: {
      justifyContent: 'flex-start',
      paddingTop: 8,
    },
    securityBar: {
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
      marginTop: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    securityLabel: {
      color: colors.mutedStrong,
      flex: 1,
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '800',
    },
    securityText: {
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '900',
    },
    subtitle: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
      lineHeight: 20,
      marginTop: 6,
    },
    title: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.title,
      fontWeight: '900',
      lineHeight: 24,
      marginTop: 10,
    },
  });
}
