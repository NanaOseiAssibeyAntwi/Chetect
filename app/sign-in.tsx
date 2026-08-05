import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { EntryBadge, EntryPanel, EntryScreen, useEntryAccents } from '@/components/entry-shell';
import { EntryField, EntryHeaderBar, EntryPrimaryAction } from '@/components/entry-auth';
import { font, radius, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';
import { signInStudent } from '@/lib/student-auth';

export default function SignInScreen() {
  const [studentId, setStudentId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { colors } = useAppTheme();
  const tone = useEntryAccents().teal;
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

  const handleStudentSignIn = async () => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      await signInStudent(studentId, password);
      router.replace('/(tabs)');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sign-in failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <EntryScreen accent="teal" keyboardAware>
      <EntryHeaderBar accent="teal" label="Student access" onBack={returnToLanding} />

      <View style={styles.wordmarkBlock}>
        <EntryBadge accent="teal" detail="KNUST" label="Exam access" />
        <Text style={styles.title}>Student Sign In</Text>
        <Text style={styles.subtitle}>Secure login for monitored exam sessions</Text>
      </View>

      <EntryPanel accent="teal" style={styles.formPanel}>
        <EntryField
          accent="teal"
          autoCapitalize="none"
          autoCorrect={false}
          icon={<Feather color={tone.accent} name="user" size={18} />}
          label="Student ID"
          onChangeText={setStudentId}
          placeholder="Student ID or username"
          value={studentId}
        />

        <EntryField
          accent="teal"
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

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </EntryPanel>

      <View style={styles.verificationCard}>
        <View style={styles.verificationLeft}>
          <View style={[styles.verificationIcon, { backgroundColor: tone.soft }]}>
            <MaterialCommunityIcons color={tone.accent} name="shield-check-outline" size={20} />
          </View>
          <View>
            <Text style={styles.verificationTitle}>Identity Verification</Text>
            <Text style={styles.verificationMeta}>Profile + session check</Text>
          </View>
        </View>
        <View style={[styles.verificationDot, { backgroundColor: colors.success }]} />
      </View>

      <EntryPrimaryAction
        accent="teal"
        isLoading={isLoading}
        label="Authenticate"
        onPress={handleStudentSignIn}
      />

      <View style={styles.footerSpacer} />

      <View style={[styles.securityBar, { backgroundColor: tone.soft, borderColor: tone.border }]}>
        <Text style={styles.securityLabel}>Access level</Text>
        <Text style={[styles.securityText, { color: tone.accent }]}>Student</Text>
      </View>
    </EntryScreen>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    errorText: {
      color: colors.danger,
      fontFamily: font.body,
      fontSize: type.body,
      marginTop: 4,
    },
    footerSpacer: {
      minHeight: 24,
    },
    formPanel: {
      gap: 16,
      marginTop: 24,
    },
    securityBar: {
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    securityLabel: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.body,
    },
    securityText: {
      fontFamily: font.body,
      fontSize: type.body,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.subtitle,
      marginTop: 10,
    },
    title: {
      color: colors.text,
      fontFamily: font.display,
      fontSize: type.display,
      fontWeight: '900',
      marginTop: 14,
    },
    verificationCard: {
      alignItems: 'center',
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    verificationDot: {
      borderRadius: 99,
      height: 6,
      width: 6,
    },
    verificationIcon: {
      alignItems: 'center',
      borderRadius: radius.sm,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    verificationLeft: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    verificationMeta: {
      color: colors.mutedStrong,
      fontFamily: font.body,
      fontSize: type.tiny,
      letterSpacing: 0.4,
      marginTop: 4,
      textTransform: 'uppercase',
    },
    verificationTitle: {
      color: colors.text,
      fontFamily: font.body,
      fontSize: 17,
      fontWeight: '700',
    },
    wordmarkBlock: {
      gap: 10,
      marginTop: 22,
    },
  });
}
