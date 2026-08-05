import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { EntryBadge, EntryPanel, EntryScreen, useEntryAccents } from '@/components/entry-shell';
import { EntryField, EntryHeaderBar, EntryPrimaryAction } from '@/components/entry-auth';
import { font, radius, type } from '@/constants/design';
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
    <EntryScreen accent="warning" keyboardAware>
      <EntryHeaderBar accent="warning" label="Invigilator access" onBack={returnToLanding} />

      <View style={styles.wordmarkBlock}>
        <EntryBadge accent="warning" detail="STAFF" label="Elevated access" />
        <Text style={styles.title}>Invigilator Sign In</Text>
        <Text style={styles.subtitle}>Staff credentials - elevated access</Text>
      </View>

      <EntryPanel accent="warning" style={styles.formPanel}>
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

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </EntryPanel>

      <EntryPrimaryAction
        accent="warning"
        isLoading={isLoading}
        label="Authenticate"
        onPress={handleInvigilatorSignIn}
      />

      <View style={styles.footerSpacer} />

      <View style={[styles.securityBar, { backgroundColor: tone.soft, borderColor: tone.border }]}>
        <Text style={styles.securityLabel}>Access level</Text>
        <Text style={[styles.securityText, { color: tone.accent }]}>Invigilator</Text>
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
    wordmarkBlock: {
      gap: 10,
      marginTop: 22,
    },
  });
}
